const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const requireAuth = require('../middleware/requireAuth');
const Emote = require('../models/Emote');
const { broadcast } = require('../realtime');

const router = express.Router();

// Mirrors the size options in the front-end Command Center
// (kestrel-streaming-site.html) — keep the two in sync if either changes.
const SIZES = {
  standard: { width: 70, height: 70 },
  wide: { width: 384, height: 128 }
};
const NAME_RE = /^[a-zA-Z0-9_]{2,24}$/;

// Uploads are held in memory just long enough to resize with sharp, then
// discarded — nothing ever touches disk. The 8MB cap is on the *original*
// upload, before it gets shrunk down to 70x70 / 384x128 for storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

function publicEmote(e) {
  return {
    name: e.name,
    size: e.size,
    width: e.width,
    height: e.height,
    mimeType: e.mimeType,
    dataUrl: e.dataUrl,
    addedBy: e.addedBy
  };
}

async function getAllPublic() {
  const emotes = await Emote.find().sort({ name: 1 });
  return emotes.map(publicEmote);
}

// GET /api/emotes — the full shared emote list. No auth required to read,
// same as chat history and the embed list: anyone visiting the site should
// see emotes render in chat, logged in or not. Only adding/removing them
// requires being logged in.
router.get('/', async (req, res) => {
  try {
    res.json({ emotes: await getAllPublic() });
  } catch (err) {
    console.error('Emotes fetch error:', err);
    res.status(500).json({ error: 'Could not load emotes.' });
  }
});

// POST /api/emotes — multipart/form-data with fields `name`, `size`
// ('standard' or 'wide'), and `file` (the image). Resizes on the server
// with sharp so animated GIFs stay animated (a plain <canvas> resize in
// the browser would flatten a GIF to a single frame) and every client
// gets back an already-correctly-sized image, nothing to resize twice.
router.post('/', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'That file is too large — 8MB max before resizing.' });
    }
    console.error('Emote upload error:', err);
    res.status(400).json({ error: 'Could not read the uploaded file.' });
  });
}, async (req, res) => {
  try {
    const name = ((req.body && req.body.name) || '').trim().toLowerCase();
    const size = (req.body && req.body.size) === 'wide' ? 'wide' : 'standard';

    if (!NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Emote name must be 2–24 characters: letters, numbers, underscores.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a PNG or GIF file.' });
    }

    const existing = await Emote.findOne({ name });
    if (existing) {
      return res.status(409).json({ error: `":${name}:" already exists — remove it first or pick another name.` });
    }

    // Trust what the file actually is over whatever mimetype/extension it
    // arrived with — sharp will throw on anything it can't decode, and we
    // only accept the two formats it reports back as.
    let inputMeta;
    try {
      inputMeta = await sharp(req.file.buffer, { animated: true }).metadata();
    } catch (err) {
      return res.status(400).json({ error: "That file couldn't be read as a PNG or GIF." });
    }
    if (inputMeta.format !== 'png' && inputMeta.format !== 'gif') {
      return res.status(400).json({ error: 'Only PNG and GIF images are allowed.' });
    }

    const isGif = inputMeta.format === 'gif';
    const { width, height } = SIZES[size];

    // { animated: true } + a height equal to one frame's height is how
    // sharp knows to resize every frame of a GIF to the target box instead
    // of squashing the whole stacked multi-frame image down to `height`
    // total — verified against a real animated GIF before shipping this.
    const pipeline = sharp(req.file.buffer, { animated: isGif }).resize(width, height, { fit: 'fill' });
    const outputBuffer = isGif ? await pipeline.gif().toBuffer() : await pipeline.png().toBuffer();
    const mimeType = isGif ? 'image/gif' : 'image/png';
    const dataUrl = `data:${mimeType};base64,${outputBuffer.toString('base64')}`;

    const emote = await Emote.create({
      name, size, width, height, mimeType, dataUrl, addedBy: req.username
    });

    const payload = { emotes: await getAllPublic(), note: `${req.username} added the :${name}: emote.` };
    broadcast('emotes', payload);
    res.status(201).json(payload);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'That emote name is already taken.' });
    }
    console.error('Emote add error:', err);
    res.status(500).json({ error: 'Could not add that emote.' });
  }
});

// DELETE /api/emotes/:name
router.delete('/:name', requireAuth, async (req, res) => {
  try {
    const name = (req.params.name || '').trim().toLowerCase();
    const existing = await Emote.findOne({ name });
    if (!existing) {
      return res.status(404).json({ error: `No emote named ":${name}:".` });
    }
    await Emote.deleteOne({ _id: existing._id });

    const payload = { emotes: await getAllPublic(), note: `${req.username} removed the :${name}: emote.` };
    broadcast('emotes', payload);
    res.json(payload);
  } catch (err) {
    console.error('Emote remove error:', err);
    res.status(500).json({ error: 'Could not remove that emote.' });
  }
});

module.exports = router;
