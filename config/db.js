// config/db.js
const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // exit process if DB fails
  }
}

module.exports = connectDB;
