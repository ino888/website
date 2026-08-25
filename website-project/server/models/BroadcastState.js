const mongoose = require('mongoose');

// One entry per stream currently "on screen" for the whole site (not just
// one visitor's browser). At most one has isMain=true — that's the shared
// main stage embed that the home page preview mirrors and that everyone
// lands on by default in Big Screen.
const embedSchema = new mongoose.Schema({
  id: { type: String, required: true },       // "<platform>:<username lowercased>"
  username: { type: String, required: true },
  platform: { type: String, required: true },
  isMain: { type: Boolean, default: false }
}, { _id: false });

// This collection only ever holds a single document (_id: 'singleton').
// Modeling shared, site-wide state as "a document everyone reads and
// writes" is the simplest way to do it without adding a new datastore.
const broadcastStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  embeds: { type: [embedSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BroadcastState', broadcastStateSchema);
