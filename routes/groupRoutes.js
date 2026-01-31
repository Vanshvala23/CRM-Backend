const express = require("express");
const router = express.Router();
const CustomerGroup = require("../models/CustomerGroup");
const Customer = require("../models/COntact"); // or Customer model name

/* ================= GET ALL GROUPS ================= */
router.get("/", async (req, res) => {
  try {
    const groups = await CustomerGroup.find().sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= CREATE GROUP ================= */
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const group = await CustomerGroup.create({ name });
    res.status(201).json(group);

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Group already exists" });
    }
    res.status(500).json({ message: err.message });
  }
});

/* ================= ASSIGN GROUPS TO CUSTOMER ================= */
router.post("/assign", async (req, res) => {
  try {
    const { customer_id, group_ids } = req.body;
    if (!customer_id || !group_ids?.length) {
      return res.status(400).json({ message: "Invalid data" });
    }

    await Customer.findByIdAndUpdate(
      customer_id,
      { $addToSet: { groups: { $each: group_ids } } }, // prevents duplicates
      { new: true }
    );

    res.json({ message: "Group(s) assigned successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
