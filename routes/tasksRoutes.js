const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const User = require("../models/User");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

const upload = multer({ dest: "uploads/tasks/" });

// ===============================
// AUTO FETCH RELATED CODE
// ===============================
async function getRelatedCode(type) {
  const map = {
    invoice:  "inv_no",
    estimate: "estimate_no",
    proposal: "prop_id",
    customer: "customer_code",
    lead:     "lead_code"
  };

  if (!map[type]) return null;

  const Model = require(`../models/${type.charAt(0).toUpperCase() + type.slice(1)}`);
  const lastDoc = await Model.findOne().sort({ _id: -1 }).select(map[type]);
  return lastDoc ? lastDoc[map[type]] : null;
}

// ===============================
// CREATE TASK
// ===============================
router.post("/", async (req, res) => {
  try {
    const {
      subject, hourly_rate, start_date, due_date, priority, description,
      related_type, repeat_every, repeat_unit, total_cycles, is_infinite,
      is_public, is_billable, assignees = [], followers = []
    } = req.body;

    if (!subject || !start_date) return res.status(400).json({ message: "Subject & Start Date required" });

    const related_id = related_type ? await getRelatedCode(related_type) : null;

    const task = new Task({
      subject, hourly_rate, start_date, due_date, priority, description,
      related_type, related_id, repeat_every, repeat_unit, total_cycles,
      is_infinite, is_public, is_billable,
      assignees, followers
    });

    await task.save();
    const populated = await task.populate("assignees followers", "name");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// GET ALL TASKS
// ===============================
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate("assignees followers", "name")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// GET SINGLE TASK
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignees followers", "name");

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// UPDATE TASK
// ===============================
router.put("/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.related_type) {
      updates.related_id = await getRelatedCode(updates.related_type);
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate("assignees followers", "name");

    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// DELETE TASK
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===============================
// IMPORT TASKS FROM CSV
// ===============================
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file required" });

  const rows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", row => rows.push(row))
    .on("end", async () => {
      try {
        for (const r of rows) {
          const related_id = r.related_type ? await getRelatedCode(r.related_type) : null;

          const task = new Task({
            subject: r.subject,
            start_date: r.start_date,
            priority: r.priority || "Low",
            related_type: r.related_type || null,
            related_id
          });

          await task.save();
        }

        fs.unlinkSync(req.file.path);
        res.json({ message: "Tasks imported", count: rows.length });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
});

module.exports = router;
