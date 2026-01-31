const express = require("express");
const router = express.Router();
const User = require("../models/User");

/* ===============================
   GET ALL USERS
================================ */
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, { name: 1 }).sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
