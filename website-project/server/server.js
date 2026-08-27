require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const embedsRoutes = require('./routes/embeds');
const emotesRoutes = require('./routes/emotes');
const liveRoutes = require('./routes/live');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);     // shared chat history + posting
app.use('/api/embeds', embedsRoutes); // shared "on screen" stream list + main stage embed
app.use('/api/emotes', emotesRoutes); // shared chat emotes — anyone signed in can add/remove
app.use('/api/live', liveRoutes);     // SSE: pushes chat + embeds + emotes updates to every open tab

// --- Static site (the Kestrel page lives one folder up from /server) ---
const SITE_DIR = path.join(__dirname, '..');
app.use(express.static(SITE_DIR));

app.get('/', (req, res) => {
  res.sendFile(path.join(SITE_DIR, 'kestrel-streaming-site.html'));
});

// --- Start server after DB connects ---
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✔ Kestrel server running at http://localhost:${PORT}`);
  });
});
