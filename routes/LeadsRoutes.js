const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ENUM Allowed Values
const ALLOWED_TYPES = ["Person", "Organization"];
const ALLOWED_STATUS = ["New", "Contacted", "Qualified", "Lost"];

/* ============================
   GET ALL LEADS
============================ */
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM leads ORDER BY created_at DESC",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

/* ============================
   GET SINGLE LEAD
============================ */
router.get("/:id", (req, res) => {
  db.query(
    "SELECT * FROM leads WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (!result.length)
        return res.status(404).json({ message: "Lead not found" });
      res.json(result[0]);
    }
  );
});

/* ============================
   CREATE LEAD
============================ */
router.post("/", (req, res) => {
  const {
    first_name,
    last_name,
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

  if (!first_name || !last_name)
    return res.status(400).json({ message: "First & Last name required" });

  const leadData = {
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
  };

  const sql = "INSERT INTO leads SET ?";

  db.query(sql, leadData, (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ message: "Lead created", id: result.insertId });
  });
});



/* ============================
   UPDATE LEAD
============================ */
router.put("/:id", (req, res) => {
  const allowedFields = [
    "first_name","last_name","type","company","email","phone","website","position",
    "address","city","state","country","zipcode",
    "status","source","industry","assigned_to","tags",
    "lead_value","currency","visibility","contacted_today","description"
  ];

  // Filter out only fields present in req.body
  const fieldsToUpdate = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      fieldsToUpdate[field] = req.body[field];
    }
  }

  if (fieldsToUpdate.type && !ALLOWED_TYPES.includes(fieldsToUpdate.type))
    return res.status(400).json({ message: "Invalid lead type" });

  if (fieldsToUpdate.status && !ALLOWED_STATUS.includes(fieldsToUpdate.status))
    return res.status(400).json({ message: "Invalid lead status" });

  if (Object.keys(fieldsToUpdate).length === 0)
    return res.status(400).json({ message: "No fields to update" });

  // Build dynamic SQL
  const setClause = Object.keys(fieldsToUpdate)
    .map(field => `${field} = ?`)
    .join(", ");

  const sql = `UPDATE leads SET ${setClause} WHERE id = ?`;

  db.query(
    sql,
    [...Object.values(fieldsToUpdate), req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (!result.affectedRows)
        return res.status(404).json({ message: "Lead not found" });

      res.json({ message: "Lead updated successfully" });
    }
  );
});


/* ============================
   DELETE LEAD
============================ */
router.delete("/:id", (req, res) => {
  db.query(
    "DELETE FROM leads WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (!result.affectedRows)
        return res.status(404).json({ message: "Lead not found" });

      res.json({ message: "Lead deleted successfully" });
    }
  );
});

router.post("/:id/convert", (req, res) => {
  const leadId = req.params.id;

  db.query(
    "SELECT * FROM leads WHERE id=?",
    [leadId],
    (err, leads) => {
      if (err) return res.status(500).json(err);
      if (!leads.length)
        return res.status(404).json({ message: "Lead not found" });

      const l = leads[0];

      const sql = `
        INSERT INTO contact
        (
          lead_id, first_name, last_name, email, phone,
          company, website, position, address,
          city, state, country, zipcode
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;

      db.query(
        sql,
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
        (err, result) => {
          if (err) return res.status(500).json(err);

          db.query(
            "UPDATE leads SET converted_to_customer=1 WHERE id=?",
            [leadId]
          );

          res.json({
            message: "Lead converted to customer",
            customer_id: result.insertId
          });
        }
      );
    }
  );
});

router.get("/customers/:id", (req, res) => {
  db.query(
    `
    SELECT c.*, l.source, l.status
    FROM customers c
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE c.id=?
    `,
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result[0]);
    }
  );
});


module.exports = router;
