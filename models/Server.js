const mongoose = require("mongoose");

const serverSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    SERVER_NAME: String,
    SUGGESTION_CHANNEL_ID: String,
    PRIORITIES_SUGGESTION_FORUM_ID: String,
    LIBRARY_CHANNEL_ID: String,
    LIBRARY_RANKED_BOOKS_ID: String,
    BOT_MASTER_ROLE_ID: String,
    REPORT_CHANNEL_ID: String,
    BOT_ADMIN_ID: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Server", serverSchema, "servers");
