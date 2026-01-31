const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const User = require("../models/User");       // your users collection
const Customer = require("../models/Customer"); // your customers collection

/* ===============================
   CREATE PROJECT + MEMBERS
================================ */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      customer_id,
      bill_type,
      status,
      rate_per_hour,
      estimated_hour,
      start_date,
      end_date,
      tags,
      description,
      members // array of user IDs
    } = req.body;

    const project = await Project.create({
      name,
      customer_id: customer_id || null,
      bill_type: bill_type || "Project hours",
      status: status || "Not started",
      rate_per_hour: rate_per_hour || null,
      estimated_hour: estimated_hour || null,
      start_date: start_date || null,
      end_date: end_date || null,
      tags: tags || [],
      description: description || "",
      members: Array.isArray(members) ? members : []
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project_id: project._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   GET ALL PROJECTS
================================ */
router.get("/", async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("customer_id", "first_name last_name")
      .sort({ createdAt: -1 });

    const formatted = projects.map(p => ({
      ...p.toObject(),
      customer_name: p.customer_id ? `${p.customer_id.first_name} ${p.customer_id.last_name}` : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   GET SINGLE PROJECT
================================ */
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("customer_id", "first_name last_name")
      .populate("members", "name");

    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json({
      ...project.toObject(),
      customer_name: project.customer_id ? `${project.customer_id.first_name} ${project.customer_id.last_name}` : null,
      member_ids: project.members.map(m => m._id),
      member_names: project.members.map(m => m.name)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   UPDATE PROJECT + MEMBERS
================================ */
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      customer_id,
      bill_type,
      status,
      rate_per_hour,
      estimated_hour,
      start_date,
      end_date,
      tags,
      description,
      members
    } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    project.name = name ?? project.name;
    project.customer_id = customer_id ?? project.customer_id;
    project.bill_type = bill_type ?? project.bill_type;
    project.status = status ?? project.status;
    project.rate_per_hour = rate_per_hour ?? project.rate_per_hour;
    project.estimated_hour = estimated_hour ?? project.estimated_hour;
    project.start_date = start_date ?? project.start_date;
    project.end_date = end_date ?? project.end_date;
    project.tags = tags ?? project.tags;
    project.description = description ?? project.description;
    if (Array.isArray(members)) project.members = members;

    await project.save();

    res.json({ success: true, message: "Project updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   DELETE PROJECT
================================ */
router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
