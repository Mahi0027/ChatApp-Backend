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
    type: {
        type: String,
        default: 'text'
    },
    read: {
        type: Boolean,
        default: false,
    },
    timeStamp: {
        type: String,
    }
});

const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
