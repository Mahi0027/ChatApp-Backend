const mongoose = require("mongoose");

const MessageSchema = mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
    },
    senderId: {
        type: String,
    },
    message: {
        type: String,
    },
    read: {
        type: Boolean,
        default: false,
    },
});

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
