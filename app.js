const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const io = require("socket.io")(8080, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});
// Connect DB
require("./db/connection");

// Import Files
const Users = require("./models/Users");
const Conversations = require("./models/Conversations.js");
const Messages = require("./models/Messages");

// app use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const port = process.env.PORT || 8000;

// socket.io
let users = [];
io.on("connection", (socket) => {
    /* on add user. */
    socket.on("addUser", (userId) => {
        if (userId) {
            const isUserExist = users.find((user) => user.userId === userId);
            if (!isUserExist) {
                const user = { userId, socketId: socket.id };
                users.push(user);
                io.emit("getUsers", users);
            }
        }
    });

    socket.on(
        "sendMessage",
        async ({ conversationId, senderId, message, receiverId }) => {
            const receiver = users.find((user) => user.userId === receiverId);
            if (receiver) {
                io.to(receiver.socketId).emit("getMessage", {
                    conversationId,
                    senderId,
                    message,
                    receiver,
                });
            }
        }
    );

    /* on disconnect user. */
    socket.on("disconnect", () => {
        users = users.filter((user) => user.socketId !== socket.id);
        io.emit("getUsers", users);
    });
});

// Routes
app.get("/", (req, res) => {
    res.send("Welcome");
});

// user registration
app.post("/api/register", async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).send("Please fill all required fields");
        } else {
            const isExistUser = await Users.findOne({ email });
            if (isExistUser) {
                res.status(400).send("User already exists.");
            } else {
                const newUser = new Users({ fullName, email });
                bcryptjs.hash(password, 10, (error, hashedPassword) => {
                    newUser.set("password", hashedPassword);
                    newUser.save();
                    next();
                });
                return res
                    .status(200)
                    .send({ message: "User registered successfully" });
            }
        }
    } catch (error) {
        res.status(400).send("Something went wrong. Error: ", error);
    }
});

// user login
app.post("/api/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).send({
                type: "error",
                heading: "Field require to fill",
                message: "Please fill all required fields.",
            });
        } else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(500).send({
                    type: "error",
                    heading: "Wrong Credentials.",
                    message:
                        "User email or password is incorrect. Please provide correct one.",
                });
            } else {
                const validateUser = await bcryptjs.compare(
                    password,
                    user.password
                );
                if (!validateUser) {
                    res.status(500).send({
                        type: "error",
                        heading: "Wrong Credentials.",
                        message:
                            "User email or password is incorrect. Please provide correct one.",
                    });
                } else {
                    const payload = {
                        userId: user._id,
                        email: user.email,
                    };
                    const JWT_SECRET_KEY =
                        process.env.JWT_SECRET_KEY ||
                        "THIS_IS_A_JWT_SECRET_KEY";
                    jwt.sign(
                        payload,
                        JWT_SECRET_KEY,
                        { expiresIn: 84600 },
                        async (error, token) => {
                            await Users.updateOne(
                                { _id: user._id },
                                {
                                    $set: { token },
                                }
                            );
                            user.save();
                            res.status(200).json({
                                user: {
                                    id: user._id,
                                    email: user.email,
                                    fullName: user.fullName,
                                },
                                token: token,
                            });
                        }
                    );
                }
            }
        }
    } catch (error) {
        res.status(500).send({
            type: "error",
            heading: "Error",
            message: `Something went wrong. Error: ${error}`,
        });
    }
});

// build conversation
app.post("/api/conversation", async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newConversation = new Conversations({
            members: [senderId, receiverId],
        });
        const result = await newConversation.save();
        res.status(200).send({
            id: result._id,
            message: "Conversation created successfully.",
        });
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

//get all user's list whom current user has talked.
app.get("/api/conversations", async (req, res) => {
    try {
        const allConversations = await Conversations.find({});
        res.status(200).json(allConversations);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

//get all user's list whom current user has talked.
app.get("/api/conversations/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversations.find({
            members: { $in: [userId] },
        });
        const conversationUserData = Promise.all(
            conversations.map(async (conversation) => {
                const receiverId = conversation.members.find(
                    (member) => member !== userId
                );
                const receiverUser = await Users.findById(receiverId);
                return {
                    user: {
                        id: receiverUser._id,
                        email: receiverUser.email,
                        fullName: receiverUser.fullName,
                    },
                    conversationId: conversation._id,
                };
            })
        );
        res.status(200).json(await conversationUserData);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

// send message
app.post("/api/message", async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = "" } = req.body;
        var newConversationId = "";
        if (!senderId || !message)
            return res.status(400).send("Please fill all required fields.");
        if (!conversationId && receiverId !== "") {
            const newConversation = new Conversations({
                members: [senderId, receiverId],
            });
            await newConversation.save();
            newConversationId = newConversation._id;
        } else {
            newConversationId = conversationId;
        }

        const newMessage = new Messages({
            conversationId: newConversationId,
            senderId,
            message,
        });
        await newMessage.save();
        res.status(200).send({ message: "Message sent successfully." });
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

// get conversations
app.get("/api/message/:conversationId", async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        if (!conversationId) return res.status(200).json([]);
        const messages = await Messages.find({ conversationId });
        const messageUserData = Promise.all(
            messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return {
                    user: {
                        id: user._id,
                        email: user.email,
                        fullName: user.fullName,
                    },
                    message: message.message,
                };
            })
        );
        res.status(200).json(await messageUserData);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

// get list of all users.
app.get("/api/users", async (req, res) => {
    try {
        const users = await Users.find();
        const usersData = await Promise.all(
            users.map(async (user) => {
                return {
                    user: {
                        id: user._id,
                        email: user.email,
                        fullName: user.fullName,
                    },
                    // userId: user._id,
                };
            })
        );
        res.status(200).json(usersData);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

// get list of all users.
app.get("/api/user/:userId", async (req, res) => {
    try {
        const user = await Users.findOne({ _id: req.params.userId });
        res.status(200).json(user);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

app.listen(port, () => {
    console.log("server is running on port: ", port);
});
