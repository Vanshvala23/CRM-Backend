const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

const ALLOWED_TYPES = ["Person", "Organization"];
const ALLOWED_STATUS = ["New", "Contacted", "Qualified", "Lost"];

/* ============================
   NAME HELPERS
============================ */
function splitName(name = "") {
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { first_name: null, last_name: null };

  const parts = name.split(" ");
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null };
  }

  return {
    first_name: parts.shift(),
    last_name: parts.join(" ")
  };
}

function joinName(first_name, last_name) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

/* ============================
   FILE UPLOAD
============================ */
const upload = multer({ dest: "uploads/" });

/* ============================
   IMPORT LEADS FROM CSV
============================ */
router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file required" });

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", row => {
      const { first_name, last_name } = splitName(row.name);

      results.push([
        first_name,
        last_name,
        row.type || "Person",
        row.company,
        row.email,
        row.phone,
        row.website,
        row.position,
        row.address,
        row.city,
        row.state,
        row.country,
        row.zipcode,
        row.status || "New",
        row.source,
        row.industry,
        row.assigned_to,
        row.tags,
        row.lead_value,
        row.currency,
        row.visibility ?? 1,
        row.contacted_today ?? 0,
        row.description
      ]);
    })
    .on("end", () => {
      const sql = `
        INSERT INTO leads
        (first_name,last_name,type,company,email,phone,website,position,
         address,city,state,country,zipcode,status,source,industry,assigned_to,tags,
         lead_value,currency,visibility,contacted_today,description)
        VALUES ?
      `;

      db.query(sql, [results], err => {
        fs.unlinkSync(req.file.path);
        if (err) return res.status(500).json(err);
        res.json({ message: "Leads imported successfully" });
      });
    });
});

/* ============================
   GET ALL LEADS
============================ */
router.get("/", (req, res) => {
  db.query("SELECT * FROM leads ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json(err);

    const leads = rows.map(l => ({
      ...l,
      name: joinName(l.first_name, l.last_name)
    }));

    res.json(leads);
  });
});

/* ============================
   GET SINGLE LEAD
============================ */
router.get("/:id", (req, res) => {
  db.query("SELECT * FROM leads WHERE id=?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });

    const lead = rows[0];
    lead.name = joinName(lead.first_name, lead.last_name);
    res.json(lead);
  });
});

/* ============================
   CREATE LEAD (UI SENDS name)
============================ */
router.post("/", (req, res) => {
  const {
    name,
    type,
    company,
    email,
    phone,
    website,
    position,
    address,
    city,
    state,
    country,
    zipcode,
    status,
    source,
    industry,
    assigned_to,
    tags,
    lead_value,
    currency,
    visibility,
    contacted_today,
    description
  } = req.body;

  const { first_name, last_name } = splitName(name);
  if (!first_name)
    return res.status(400).json({ message: "Name is required" });

  const sql = "INSERT INTO leads SET ?";

  db.query(sql, {
    first_name,
    last_name,
    type: type || "Person",
    company,
    email,
    phone,
    website,
    position,
    address,
    city,
    state,
    country,
    zipcode,
    status: status || "New",
    source,
    industry,
    assigned_to,
    tags,
    lead_value,
    currency,
    visibility: visibility ?? 1,
    contacted_today: contacted_today ?? 0,
    description
  }, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ message: "Lead created", id: result.insertId });
  });
});

/* ============================
   UPDATE LEAD (name only)
============================ */
router.put("/:id", (req, res) => {
  const fields = {};

  if (req.body.name) {
    const { first_name, last_name } = splitName(req.body.name);
    fields.first_name = first_name;
    fields.last_name = last_name;
  }

  const allowed = [
    "type","company","email","phone","website","position","address","city",
    "state","country","zipcode","status","source","industry","assigned_to",
    "tags","lead_value","currency","visibility","contacted_today","description"
  ];

  allowed.forEach(f => {
    if (req.body[f] !== undefined) fields[f] = req.body[f];
  });

  if (!Object.keys(fields).length)
    return res.status(400).json({ message: "No fields to update" });

  const sql = `UPDATE leads SET ? WHERE id=?`;

  db.query(sql, [fields, req.params.id], err => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Lead updated" });
  });
});

/* ============================
   CONVERT LEAD TO CUSTOMER
============================ */
router.post("/:id/convert", (req, res) => {
  const leadId = req.params.id;

  db.query("SELECT * FROM leads WHERE id=?", [leadId], (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });

    const l = rows[0];

    db.query(
      `
      INSERT INTO contact
      (lead_id, first_name, last_name, email, phone, company, website, position,
       address, city, state, country, zipcode)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
      [
        leadId,
        l.first_name,
        l.last_name,
        l.email,
        l.phone,
        l.company,
        l.website,
        l.position,
        l.address,
        l.city,
        l.state,
        l.country,
        l.zipcode
      ],
      err => {
        if (err) return res.status(500).json(err);
        db.query("UPDATE leads SET converted_to_customer=1 WHERE id=?", [leadId]);
        res.json({ message: "Lead converted successfully" });
      }
    );
  });
});

module.exports = router;
