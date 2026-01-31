const express = require("express");
const router = express.Router();
const Ticket = require("../models/Ticket");
const Contact = require("../models/COntact");
const Department = require("../models/Department");
const Service = require("../models/Service");
const User = require("../models/User");

// ==============================
// CREATE TICKET
// ==============================
router.post("/", async (req, res) => {
  try {
    const {
      ticket_type, subject, contact_id, name, email,
      department_id, service_id, assigned_to, priority, cc
    } = req.body;

    if (!ticket_type || !subject || !department_id || !service_id || !assigned_to) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    let contact = null;
    let finalName = null;
    let finalEmail = null;

    if (ticket_type === "with_contact") {
      if (!contact_id) return res.status(400).json({ message: "Contact is required" });
      contact = contact_id;
    } else {
      if (!name || !email) return res.status(400).json({ message: "Name and Email are required" });
      finalName = name;
      finalEmail = email;
    }

    const ticket = new Ticket({
      ticket_type,
      subject,
      contact,
      name: finalName,
      email: finalEmail,
      department: department_id,
      service: service_id,
      assigned_to,
      priority: priority || "medium",
      cc: cc || null
    });

    await ticket.save();

    const populated = await ticket
      .populate("contact", "first_name last_name email")
      .populate("department", "name")
      .populate("service", "name")
      .populate("assigned_to", "name");

    res.status(201).json(populated);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// GET ALL TICKETS
// ==============================
router.get("/", async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate("contact", "first_name last_name email")
      .populate("department", "name")
      .populate("service", "name")
      .populate("assigned_to", "name")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// GET SINGLE TICKET
// ==============================
router.get("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("contact", "first_name last_name email")
      .populate("department", "name")
      .populate("service", "name")
      .populate("assigned_to", "name");

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// UPDATE TICKET
// ==============================
router.put("/:id", async (req, res) => {
  try {
    const updates = { ...req.body };
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate("contact", "first_name last_name email")
      .populate("department", "name")
      .populate("service", "name")
      .populate("assigned_to", "name");

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==============================
// DELETE TICKET
// ==============================
router.delete("/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    res.json({ message: "Ticket deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
