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
  return parts.length === 1
    ? { first_name: parts[0], last_name: null }
    : { first_name: parts.shift(), last_name: parts.join(" ") };
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
router.post("/import", upload.single("file"), async (req, res) => {
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
    .on("end", async () => {
      try {
        const sql = `
          INSERT INTO leads
          (first_name,last_name,type,company,email,phone,website,position,
           address,city,state,country,zipcode,status,source,industry,assigned_to,tags,
           lead_value,currency,visibility,contacted_today,description)
          VALUES ?
        `;
        await db.query(sql, [results]);
        fs.unlinkSync(req.file.path);
        res.json({ message: "Leads imported successfully" });
      } catch (err) {
        fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
      }
    });
});

/* ============================
   GET ALL LEADS
============================ */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM leads ORDER BY created_at DESC"
    );
    const leads = rows.map(l => ({ ...l, name: joinName(l.first_name, l.last_name) }));
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   GET SINGLE LEAD
============================ */
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

/* ============================
   CREATE LEAD
============================ */
router.post("/", async (req, res) => {
  try {
    const { name, type, ...rest } = req.body;
    const { first_name, last_name } = splitName(name);
    if (!first_name) return res.status(400).json({ message: "Name is required" });

    const data = {
      first_name,
      last_name,
      type: type || "Person",
      ...rest,
      visibility: rest.visibility ?? 1,
      contacted_today: rest.contacted_today ?? 0
    };

    const [result] = await db.query("INSERT INTO leads SET ?", data);
    res.status(201).json({ message: "Lead created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   UPDATE LEAD
============================ */
router.put("/:id", async (req, res) => {
  try {
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

    if (!Object.keys(fields).length) return res.status(400).json({ message: "No fields to update" });

    await db.query("UPDATE leads SET ? WHERE id=?", [fields, req.params.id]);
    res.json({ message: "Lead updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   CONVERT LEAD TO CUSTOMER
============================ */
router.post("/:id/convert", async (req, res) => {
  try {
    const leadId = req.params.id;
    const [rows] = await db.query("SELECT * FROM leads WHERE id=?", [leadId]);
    if (!rows.length) return res.status(404).json({ message: "Lead not found" });

    const l = rows[0];

    await db.query(
      `INSERT INTO contact
      (lead_id, first_name, last_name, email, phone, company, website, position,
       address, city, state, country, zipcode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      ]
    );

    await db.query("UPDATE leads SET converted_to_customer=1 WHERE id=?", [leadId]);
    res.json({ message: "Lead converted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
