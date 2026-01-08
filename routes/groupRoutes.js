const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all groups
router.get("/", async (req, res) => {
  try {
    const [groups] = await db.query("SELECT * FROM customer_groups");
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create new group
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    const [result] = await db.query("INSERT INTO customer_groups (name) VALUES (?)", [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Group already exists" });
    res.status(500).json({ message: err.message });
  }
});

// Assign groups to customer
router.post("/assign", async (req, res) => {
  try {
    const { customer_id, group_ids } = req.body;
    if (!customer_id || !group_ids?.length) return res.status(400).json({ message: "Invalid data" });

    const values = group_ids.map(gid => [customer_id, gid]);
    await db.query("INSERT IGNORE INTO customer_group_map (customer_id, group_id) VALUES ?", [values]);
    res.json({ message: "Group(s) assigned successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
