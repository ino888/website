require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(cookieParser());

// --- API routes ---
app.use('/api/auth', authRoutes);

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
