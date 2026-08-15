const mongoose = require('mongoose');

// Connects to MongoDB using MONGODB_URI from .env. Exits the process on
// failure - there's no useful way for the API to run without a database, so
// fail fast and loud instead of limping along and throwing on every request.
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set in your .env file');
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
