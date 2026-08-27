const mongoose = require('mongoose');

// One document per custom chat emote. The image is stored already resized
// (see routes/emotes.js, which does the resizing with sharp at upload time)
// as a base64 data URL — small enough for a Mongo document, and it means
// the client never has to fetch a separate image file to render an emote,
// just like everything else this app pushes over the shared/live state.
const emoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 2,
    maxlength: 24
  },
  // 'standard' = 70x70, the usual square emote size that fits inline with
  // chat text. 'wide' = 384x128, for banner-style emotes. Kept as a label
  // (rather than trusting width/height alone) so the add-emote form and
  // the server always agree on what the two allowed sizes are.
  size: {
    type: String,
    enum: ['standard', 'wide'],
    required: true
  },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  mimeType: { type: String, enum: ['image/png', 'image/gif'], required: true },
  dataUrl: { type: String, required: true },
  addedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Emote', emoteSchema);
