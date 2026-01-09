const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all departments
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM departments");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create department
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    await db.query("INSERT INTO departments (name) VALUES (?)", [name]);
    res.json({ message: "Department created" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
