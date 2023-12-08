const mongoose = require("mongoose");

const ConversationSchema = mongoose.Schema({
    groupName: {
        type: String,
    },
    members: {
        type: Array,
        required: true,
    },
    isGroup: {
        type: Boolean,
        default: false,
    },
});

const Conversation = mongoose.model("Conversation", ConversationSchema);

module.exports = Conversation;
