const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
    },
    nickName: {
        type: String,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    status: {
        type: String,
    },
    profileImage: {
        type: String,
    },
    theme: {
        type: Number,
        required: true,
    },
    token: {
        type: String,
    },
});

const Users = mongoose.model("User", userSchema);

module.exports = Users;
