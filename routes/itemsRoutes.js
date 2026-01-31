const express = require("express");
const router = express.Router();
const Item = require("../models/Item");

/* ==============================
   GET ALL MASTER ITEMS
============================== */
router.get("/", async (req, res) => {
  try {
    const items = await Item.find().sort({ name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   GET SINGLE ITEM
============================== */
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   CREATE MASTER ITEM
============================== */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      long_description,
      rate,
      tax1,
      tax2,
      unit,
      item_group
    } = req.body;

    if (!name)
      return res.status(400).json({ message: "Name is required" });

    const item = await Item.create({
      name,
      description,
      long_description,
      rate: rate || 0,
      tax1: tax1 || 0,
      tax2: tax2 || 0,
      unit,
      item_group
    });

    res.status(201).json({ message: "Item added", id: item._id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   UPDATE MASTER ITEM
============================== */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Item not found" });

    res.json({ message: "Item updated" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   DELETE MASTER ITEM
============================== */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Item not found" });

    res.json({ message: "Item deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
