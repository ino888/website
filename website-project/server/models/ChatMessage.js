const mongoose = require('mongoose');

// Every chat message everyone sends lives here, so the chat is a shared,
// persisted feed instead of something only visible in the browser tab that
// typed it.
const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 200
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

chatMessageSchema.index({ createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
