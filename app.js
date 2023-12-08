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
let activeUsers = [];
io.on("connection", (socket) => {
    /* on add user. */
    socket.on("addUser", (userId) => {
        if (userId) {
            const isUserExist = activeUsers.find(
                (user) => user.userId === userId
            );
            if (!isUserExist) {
                const activeUser = { userId, socketId: socket.id };
                activeUsers.push(activeUser);
                io.emit("getUsers", activeUsers);
            }
        }
    });

    socket.on(
        "sendMessage",
        async ({
            conversationId,
            senderId,
            message,
            type,
            timeStamp,
            receiverId,
        }) => {
            const receiver = activeUsers.find(
                (user) => user.userId === receiverId
            );
            if (receiver) {
                io.to(receiver.socketId).emit("getMessage", {
                    conversationId,
                    senderId,
                    message,
                    type,
                    timeStamp,
                    receiver,
                });
            }
        }
    );

    /* on disconnect user. */
    socket.on("disconnect", () => {
        activeUsers = activeUsers.filter((user) => user.socketId !== socket.id);
        io.emit("getUsers", activeUsers);
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
            res.status(400).send({
                type: "error",
                heading: "Field require to fill",
                message: "Please fill all required fields.",
            });
        } else {
            const isExistUser = await Users.findOne({ email });
            if (isExistUser) {
                res.status(500).send({
                    type: "error",
                    heading: "User Error",
                    message: "User is already exists.",
                });
            } else {
                const newUser = new Users({
                    email: email,
                    firstName: fullName,
                    lastName: "",
                    nickName: "",
                    profileImage: "",
                    theme: 0,
                });
                bcryptjs.hash(password, 10, (error, hashedPassword) => {
                    newUser.set("password", hashedPassword);
                    newUser.save();
                    next();
                });
                res.status(200).send({
                    type: "success",
                    heading: "Success",
                    message: "User registered successfully.",
                });
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

// user profile update
app.post("/api/userUpdate", async (req, res, next) => {
    try {
        const { firstName, lastName, nickName, email, status, profileImage } =
            req.body;
        if (!firstName) {
            res.status(400).send({
                type: "error",
                heading: "Error",
                message: `Please fill you firstName field.`,
            });
        }
        if (!nickName) {
            res.status(400).send({
                type: "error",
                heading: "Error",
                message: `Please fill you nickName field.`,
            });
        }
        if (!email) {
            res.status(400).send({
                type: "error",
                heading: "Error",
                message: `Please fill you email  field.`,
            });
        }
        const isExistUser = await Users.findOne({ email });
        if (!isExistUser) {
            res.status(500).send({
                type: "error",
                heading: "Error",
                message: `Could not find User. Please first register yourself.`,
            });
        }
        const updatedUser = await Users.findOneAndUpdate(
            { email },
            {
                $set: { firstName, lastName, nickName, status, profileImage },
            },
            { returnDocument: "after" }
        );
        res.status(200).send({
            type: "success",
            heading: "Success",
            message: `Successfully Updated User`,
            data: JSON.stringify(updatedUser),
        });
    } catch (error) {
        res.status(500).send({
            type: "error",
            heading: "Error",
            message: `Something went wrong. Error: ${error}`,
        });
    }
});

// user theme update
app.post("/api/userThemeUpdate", async (req, res, next) => {
    try {
        const { email, theme } = req.body;
        if (!email) {
            res.status(400).send({
                type: "error",
                heading: "Error",
                message: `Could not get email. Please refresh page.`,
            });
        }
        const isExistUser = await Users.findOne({ email });
        if (!isExistUser) {
            res.status(500).send({
                type: "error",
                heading: "Error",
                message: `Could not find User. Please first register yourself.`,
            });
        }
        const updatedUser = await Users.findOneAndUpdate(
            { email },
            {
                $set: { theme },
            },
            { returnDocument: "after" }
        );
        res.status(200).send({
            type: "success",
            heading: "Success",
            message: `Successfully theme has been updated.`,
            data: JSON.stringify(updatedUser),
        });
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

// build conversation
app.post("/api/createGroup", async (req, res) => {
    try {
        const { groupName, adminId, userIds } = req.body;
        const newConversation = new Conversations({
            groupName: groupName,
            members: [adminId, ...userIds],
            isGroup: true,
        });
        const result = await newConversation.save();
        res.status(200).send({
            type: "success",
            heading: "Success",
            message: "Group Created successfully.",
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
                const receiverId = conversation.members.filter(
                    (member) => member !== userId
                );
                const usersDetail = [];
                for (let id of receiverId) {
                    const receiverUser = await Users.findById(id);
                    const temp = {
                        id: receiverUser._id,
                        email: receiverUser.email,
                        firstName: receiverUser.firstName,
                        lastName: receiverUser.lastName,
                        profileImage: receiverUser.profileImage,
                    };
                    usersDetail.push(temp);
                }
                return {
                    users: usersDetail,
                    conversationId: conversation._id,
                    isGroup: conversation.isGroup,
                    groupName: conversation.groupName,
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
        const {
            conversationId,
            senderId,
            message,
            type,
            timeStamp,
            receiverId = "",
        } = req.body;
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
            type,
            timeStamp: timeStamp,
        });
        await newMessage.save();
        res.status(200).send({ message: "Message sent successfully." });
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

// get conversations
app.get("/api/message/:conversationId/:senderId", async (req, res) => {
    try {
        const conversationId = req.params.conversationId;
        const senderId = req.params.senderId;
        if (!conversationId) return res.status(200).json([]);
        const messages = await Messages.find({ conversationId });
        const messageUserData = Promise.all(
            messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return {
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    },
                    message: message.message,
                    type: message.type,
                    timeStamp: message.timeStamp,
                };
            })
        );
        /* update read status to true. */
        await Messages.updateMany(
            { conversationId, senderId },
            { $set: { read: true } }
        );
        res.status(200).json(await messageUserData);
    } catch (error) {
        res.status(400).send(`Something went wrong. Error: ${error}`);
    }
});

/* update message read status. */
app.get(
    "/api/messageReadUpdate/:conversationId/:senderId",
    async (req, res) => {
        try {
            const conversationId = req.params.conversationId;
            const senderId = req.params.senderId;
            await Messages.updateMany(
                { conversationId, senderId },
                { $set: { read: true } }
            );
            res.status(200).send({ message: "Message read successfully." });
        } catch (error) {
            res.status(400).send({
                message: `Something went wrong. Error: ${error}`,
            });
        }
    }
);

/* get unread messages count. */
app.get(
    "/api/unreadMessagesCount/:conversationId/:senderId",
    async (req, res) => {
        try {
            const conversationId = req.params.conversationId;
            const senderId = req.params.senderId;

            const allUnreadMessages = await Messages.find({
                conversationId,
                senderId,
                read: false,
            });
            res.status(200).send({
                message: "Message read successfully.",
                data: allUnreadMessages,
            });
        } catch (error) {
            res.status(400).send({
                message: `Something went wrong. Error: ${error.message}`,
            });
        }
    }
);

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
                        firstName: user.firstName,
                        lastName: user.lastName,
                        profileImage: user.profileImage,
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

// get user users.
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
