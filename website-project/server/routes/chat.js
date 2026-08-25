const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const ChatMessage = require('../models/ChatMessage');
const { broadcast } = require('../realtime');

const router = express.Router();

function publicMessage(msg) {
  return {
    id: msg._id.toString(),
    username: msg.username,
    text: msg.text,
    createdAt: msg.createdAt
  };
}

// GET /api/chat/messages — the most recent messages, oldest first, so
// anyone who opens (or refreshes) the site sees the same shared history
// everyone else does, instead of an empty feed only they can see.
router.get('/messages', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const docs = await ChatMessage.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ messages: docs.reverse().map(publicMessage) });
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Could not load chat history.' });
  }
});

// POST /api/chat/messages — post a message. Requires login, same as
// before; the difference now is it's saved and broadcast live to every
// connected tab, so everyone sees it, not just the sender.
router.post('/messages', requireAuth, async (req, res) => {
  try {
    const text = ((req.body && req.body.text) || '').trim();
    if (!text) return res.status(400).json({ error: 'Message is empty.' });
    if (text.length > 200) return res.status(400).json({ error: 'Message is too long.' });

    const msg = await ChatMessage.create({
      userId: req.userId,
      username: req.username,
      text
    });

    const payload = publicMessage(msg);
    broadcast('chat', payload);
    res.status(201).json({ message: payload });
  } catch (err) {
    console.error('Chat post error:', err);
    res.status(500).json({ error: 'Could not send your message.' });
  }
});

module.exports = router;
