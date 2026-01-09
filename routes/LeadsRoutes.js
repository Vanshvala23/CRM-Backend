const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

// Multer config for CSV uploads
const upload = multer({ dest: "uploads/" });

/* =========================
   NAME HELPERS
========================= */
function splitName(name = "") {
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { first_name: null, last_name: null };
  const parts = name.split(" ");
  return parts.length === 1
    ? { first_name: parts[0], last_name: null }
    : { first_name: parts.shift(), last_name: parts.join(" ") };
}

function joinName(first_name, last_name) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

/* =========================
   GET ALL LEADS
========================= */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM leads ORDER BY created_at DESC");
    const leads = rows.map(l => ({ ...l, name: joinName(l.first_name, l.last_name) }));
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE LEAD
========================= */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM leads WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });
    const lead = { ...rows[0], name: joinName(rows[0].first_name, rows[0].last_name) };
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CREATE LEAD
========================= */
router.post("/", async (req, res) => {
  try {
    const { name, ...rest } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });

    // Split the name field into first_name and last_name
    const { first_name, last_name } = splitName(name);

    const data = {
      first_name,
      last_name,
      status: rest.status || "New",
      source: rest.source || null,
      assigned_to: rest.assigned_to || null, // frontend sends string like "Admin"
      tags: rest.tags || null,
      position: rest.position || null,
      email: rest.email || null,
      website: rest.website || null,
      phone: rest.phone || null,
      lead_value: rest.lead_value || 0,
      company: rest.company || null,
      description: rest.description || null,
      address: rest.address || null,
      city: rest.city || null,
      state: rest.state || null,
      country: rest.country || null,
      zipcode: rest.zipcode || null,
      default_language: rest.default_language || "System Default",
      is_public: rest.is_public ? 1 : 0,
      contacted_today: rest.contacted_today ? 1 : 0,
      currency: rest.currency || "USD",
      created_at: new Date(),
      updated_at: new Date()
    };

    const [result] = await db.query("INSERT INTO leads SET ?", data);
    res.status(201).json({ message: "Lead created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* =========================
   UPDATE LEAD
========================= */
router.put("/:id", async (req, res) => {
  try {
    const fields = {};
    if (req.body.name) {
      const { first_name, last_name } = splitName(req.body.name);
      fields.first_name = first_name;
      fields.last_name = last_name;
    }

    const allowed = [
      "status","source","assigned_to","tags","position","email","website","phone",
      "lead_value","company","description","address","city","state","country","zipcode",
      "default_language","is_public","contacted_today","currency"
    ];

    allowed.forEach(f => {
      if (req.body[f] !== undefined) {
        fields[f] = (f === "is_public" || f === "contacted_today") 
          ? (req.body[f] ? 1 : 0) 
          : req.body[f];
      }
    });

    if (!Object.keys(fields).length) return res.status(400).json({ message: "No fields to update" });

    fields.updated_at = new Date();

    await db.query("UPDATE leads SET ? WHERE id=?", [fields, req.params.id]);
    res.json({ message: "Lead updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE LEAD (Soft Delete)
========================= */
router.delete("/:id", async (req, res) => {
  try {
    await db.query("UPDATE leads SET deleted_at=NOW() WHERE id=?", [req.params.id]);
    await db.query("delete from leads where id=?",[req.params.id]);
    await db.query("alter table leads auto_increment=1")
    res.json({ message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
