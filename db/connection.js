const mongoose = require("mongoose");

const url =
    "mongodb+srv://mahi456828:00MongoChatApp@cluster0.owawrer.mongodb.net/";
mongoose
    .connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Connected to DB");
    })
    .catch((e) => {
        console.log("error", e);
    });
