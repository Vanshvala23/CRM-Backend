const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ENUM Allowed Values
const ALLOWED_TYPES = ["Person", "Organization"];
const ALLOWED_STATUS = ["New", "Contacted", "Qualified", "Lost"];
const ALLOWED_VISIBILITY = ["Public", "Private"];

// ============================
// Get All Leads
// ============================
router.get("/", (req, res) => {
  db.query("SELECT * FROM leads", (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json(result);
  });
});

// ============================
// Get Lead By ID
// ============================
router.get("/:id", (req, res) => {
  db.query("SELECT * FROM leads WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.status(404).json({ message: "Lead Not Found" });
    res.json(result[0]);
  });
});

// ============================
// Create Lead
// ============================
router.post("/", (req, res) => {
  const {
    name,
    type,
    company,
    tag,
    value,
    currency,
    phone,
    source,
    industry,
    owner,
    description,
    visibility,
    collaborators,
    status
  } = req.body;

  // Required Fields Validation
  if (!name || !value || !currency || !phone)
    return res.status(400).json({ message: "Required fields missing (name, value, currency, phone)" });

  // ENUM Validations
  if (type && !ALLOWED_TYPES.includes(type))
    return res.status(400).json({ message: "Invalid Lead Type" });

  if (status && !ALLOWED_STATUS.includes(status))
    return res.status(400).json({ message: "Invalid Lead Status" });

  if (visibility && !ALLOWED_VISIBILITY.includes(visibility))
    return res.status(400).json({ message: "Invalid Visibility Type" });

  const sql = `
    INSERT INTO leads
    (name,type,company,tag,value,currency,phone,source,industry,owner,description,visibility,collaborators,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [name, type, company, tag, value, currency, phone, source, industry, owner, description, visibility, collaborators, status],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Lead Created Successfully", id: result.insertId });
    }
  );
});

// ============================
// Update Lead
// ============================
router.put("/:id", (req, res) => {
  const {
    name,
    type,
    company,
    tag,
    value,
    currency,
    phone,
    source,
    industry,
    owner,
    description,
    visibility,
    collaborators,
    status
  } = req.body;

  if (type && !ALLOWED_TYPES.includes(type))
    return res.status(400).json({ message: "Invalid Lead Type" });

  if (status && !ALLOWED_STATUS.includes(status))
    return res.status(400).json({ message: "Invalid Lead Status" });

  if (visibility && !ALLOWED_VISIBILITY.includes(visibility))
    return res.status(400).json({ message: "Invalid Visibility Type" });

  const sql = `
    UPDATE leads SET
    name=?, type=?, company=?, tag=?, value=?, currency=?, phone=?, source=?, industry=?, owner=?, description=?, visibility=?, collaborators=?, status=?
    WHERE id=?
  `;

  db.query(
    sql,
    [name, type, company, tag, value, currency, phone, source, industry, owner, description, visibility, collaborators, status, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.affectedRows === 0)
        return res.status(404).json({ message: "Lead Not Found" });

      res.json({ message: "Lead Updated Successfully" });
    }
  );
});

// ============================
// Delete Lead
// ============================
router.delete("/:id", (req, res) => {
  db.query("DELETE FROM leads WHERE id = ?", [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Lead Not Found" });

    res.json({ message: "Lead Deleted Successfully" });
  });
});

module.exports = router;
