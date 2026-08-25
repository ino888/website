const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const BroadcastState = require('../models/BroadcastState');
const { broadcast } = require('../realtime');

const router = express.Router();

// Mirrors the platform list + limits in the front-end embed manager
// (kestrel-streaming-site.html) — keep the two in sync if either changes.
const MAX_EMBEDS = 8;
const PLATFORMS = ['kick', 'twitch', 'youtube', 'rumble', 'angelthump'];
const HANDLE_RE = /^[a-zA-Z0-9_\-.]{2,40}$/;

function normalizePlatform(p) {
  p = (p || '').toLowerCase().trim();
  return PLATFORMS.includes(p) ? p : 'kick';
}

async function getState() {
  let state = await BroadcastState.findById('singleton');
  if (!state) state = await BroadcastState.create({ _id: 'singleton', embeds: [] });
  return state;
}

function publicState(state) {
  return {
    embeds: state.embeds.map((e) => ({ id: e.id, username: e.username, platform: e.platform, isMain: e.isMain })),
    // Lets clients tell "this is the same update I already applied" apart
    // from "this is new" — e.g. when the HTTP response to their own POST
    // and its SSE broadcast both arrive, they should only act on it once.
    version: (state.updatedAt || new Date()).getTime()
  };
}

// Saves + broadcasts in one step so every mutating route below does the
// same thing on success: persist, tell every connected tab, and hand the
// caller back the same payload their own request just produced.
async function saveAndBroadcast(state, actor, note) {
  state.updatedAt = new Date();
  await state.save();
  const payload = publicState(state);
  payload.note = note;
  payload.actor = actor;
  broadcast('embeds', payload);
  return payload;
}

// GET /api/embeds — the shared "on screen" list and which one is the main
// stage embed. Everyone gets the same answer, which is what lets the home
// page preview and everyone's Big Screen agree on what's live.
router.get('/', async (req, res) => {
  try {
    const state = await getState();
    res.json(publicState(state));
  } catch (err) {
    console.error('Embeds fetch error:', err);
    res.status(500).json({ error: 'Could not load the shared stream list.' });
  }
});

// POST /api/embeds/add  { username, platform }
router.post('/add', requireAuth, async (req, res) => {
  try {
    const username = ((req.body && req.body.username) || '').trim();
    const platform = normalizePlatform(req.body && req.body.platform);
    if (!username || !HANDLE_RE.test(username)) {
      return res.status(400).json({ error: `"${username}" doesn't look like a valid username.` });
    }

    const state = await getState();
    const id = `${platform}:${username.toLowerCase()}`;
    if (state.embeds.some((e) => e.id === id)) {
      return res.status(409).json({ error: `${username} is already on screen.` });
    }
    if (state.embeds.length >= MAX_EMBEDS) {
      return res.status(400).json({ error: `Max ${MAX_EMBEDS} streams on screen — remove one first.` });
    }

    const isFirst = state.embeds.length === 0;
    state.embeds.push({ id, username, platform, isMain: isFirst });
    const note = `${req.username} added ${username}${isFirst ? ' as the main stream.' : ' to the list.'}`;
    const payload = await saveAndBroadcast(state, req.username, note);
    res.status(201).json(payload);
  } catch (err) {
    console.error('Embeds add error:', err);
    res.status(500).json({ error: 'Could not add that stream.' });
  }
});

// POST /api/embeds/remove  { username, platform }
router.post('/remove', requireAuth, async (req, res) => {
  try {
    const username = ((req.body && req.body.username) || '').trim();
    const platform = normalizePlatform(req.body && req.body.platform);
    const id = `${platform}:${username.toLowerCase()}`;

    const state = await getState();
    const entry = state.embeds.find((e) => e.id === id);
    if (!entry) return res.status(404).json({ error: `No embed found for "${username}".` });

    const wasMain = entry.isMain;
    state.embeds = state.embeds.filter((e) => e.id !== id);
    if (wasMain && state.embeds.length) state.embeds[0].isMain = true;

    const note = `${req.username} removed ${entry.username}.`;
    const payload = await saveAndBroadcast(state, req.username, note);
    res.json(payload);
  } catch (err) {
    console.error('Embeds remove error:', err);
    res.status(500).json({ error: 'Could not remove that stream.' });
  }
});

// POST /api/embeds/main  { username, platform } — promote a stream to the
// shared main stage embed (this is the one the home page preview mirrors).
router.post('/main', requireAuth, async (req, res) => {
  try {
    const username = ((req.body && req.body.username) || '').trim();
    const platform = normalizePlatform(req.body && req.body.platform);
    if (!username || !HANDLE_RE.test(username)) {
      return res.status(400).json({ error: `"${username}" doesn't look like a valid username.` });
    }

    const state = await getState();
    const id = `${platform}:${username.toLowerCase()}`;
    const existing = state.embeds.find((e) => e.id === id);
    if (!existing && state.embeds.length >= MAX_EMBEDS) {
      return res.status(400).json({ error: `Max ${MAX_EMBEDS} streams on screen — remove one first.` });
    }

    state.embeds.forEach((e) => { e.isMain = false; });
    if (existing) existing.isMain = true;
    else state.embeds.unshift({ id, username, platform, isMain: true });

    const note = `${req.username} set ${username} as the main stream.`;
    const payload = await saveAndBroadcast(state, req.username, note);
    res.json(payload);
  } catch (err) {
    console.error('Embeds main error:', err);
    res.status(500).json({ error: 'Could not change the main stream.' });
  }
});

// POST /api/embeds/main/clear — demote the current main; it stays on the list.
router.post('/main/clear', requireAuth, async (req, res) => {
  try {
    const state = await getState();
    const current = state.embeds.find((e) => e.isMain);
    if (!current) return res.status(400).json({ error: "There's no main stream to remove." });

    current.isMain = false;
    const note = `${req.username} took ${current.username} off the main stage.`;
    const payload = await saveAndBroadcast(state, req.username, note);
    res.json(payload);
  } catch (err) {
    console.error('Embeds main-clear error:', err);
    res.status(500).json({ error: 'Could not update the main stream.' });
  }
});

// POST /api/embeds/clear — clear the whole shared list.
router.post('/clear', requireAuth, async (req, res) => {
  try {
    const state = await getState();
    if (!state.embeds.length) return res.json(publicState(state));

    state.embeds = [];
    const note = `${req.username} cleared the stream list.`;
    const payload = await saveAndBroadcast(state, req.username, note);
    res.json(payload);
  } catch (err) {
    console.error('Embeds clear error:', err);
    res.status(500).json({ error: 'Could not clear the list.' });
  }
});

module.exports = router;
