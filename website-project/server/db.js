const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('✘ Missing MONGODB_URI in your .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✔ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('✘ Could not connect to MongoDB Atlas:', err.message);
    console.error('  Check that your password is correct in .env and that your current IP is allowed under Atlas → Network Access.');
    process.exit(1);
  }
}

module.exports = connectDB;
