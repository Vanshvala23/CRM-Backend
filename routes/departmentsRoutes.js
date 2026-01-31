const express = require("express");
const router = express.Router();
const Department = require("../models/Department");

/* ======================
   GET ALL DEPARTMENTS
====================== */
router.get("/", async (req, res) => {
  try {
    const rows = await Department.find().sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   CREATE DEPARTMENT
====================== */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name)
      return res.status(400).json({ message: "Name required" });

    await Department.create({ name });

    res.json({ message: "Department created" });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Department already exists" });

    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
