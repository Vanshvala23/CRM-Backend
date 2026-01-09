const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all services
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM services");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create service
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    await db.query("INSERT INTO services (name) VALUES (?)", [name]);
    res.json({ message: "Service created" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
