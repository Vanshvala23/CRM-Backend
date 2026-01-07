const express = require("express");
const db = require("../config/db");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

// Configure multer
const upload = multer({ dest: "uploads/" });

/* ======================
   NAME HELPERS
====================== */
function splitName(name = "") {
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { first_name: null, last_name: null };

  const parts = name.split(" ");
  if (parts.length === 1) return { first_name: parts[0], last_name: null };

  return {
    first_name: parts.shift(),
    last_name: parts.join(" "),
  };
}

function joinName(first_name, last_name) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

/* ======================
   IMPORT CONTACTS FROM CSV
====================== */
router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file required" });

  const results = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      const { first_name, last_name } = splitName(row.name);

      results.push([
        first_name,
        last_name,
        row.email,
        row.phone,
        row.address,
        row.city,
        row.state,
        row.country,
        row.zipcode,
        row.website,
        row.currency,
        row.language,
        row.GST,
      ]);
    })
    .on("end", () => {
      const sql = `
        INSERT INTO contact
        (first_name,last_name,email,phone,address,city,state,country,zipcode,website,currency,language,GST)
        VALUES ?
      `;

      db.query(sql, [results], (err, result) => {
        fs.unlinkSync(req.file.path);
        if (err) return res.status(500).json(err);

        res.json({ message: `Imported ${result.affectedRows} contacts successfully` });
      });
    });
});

/* ======================
   GET ALL CONTACTS
====================== */
router.get("/", (req, res) => {
  db.query("SELECT * FROM contact WHERE deleted_at IS NULL", (err, rows) => {
    if (err) return res.status(500).json(err);

    const data = rows.map(c => ({
      ...c,
      name: joinName(c.first_name, c.last_name),
    }));

    res.json(data);
  });
});

/* ======================
   GET SINGLE CONTACT
====================== */
router.get("/:id", (req, res) => {
  db.query(
    `
    SELECT c.*, g.id AS group_id, g.name AS group_name
    FROM contact c
    LEFT JOIN customer_group_map cg ON c.id = cg.customer_id
    LEFT JOIN customer_groups g ON cg.group_id = g.id
    WHERE c.id=? AND c.deleted_at IS NULL
    `,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const contact = {
        ...rows[0],
        name: joinName(rows[0].first_name, rows[0].last_name),
        groups: rows
          .filter(r => r.group_id)
          .map(r => ({ id: r.group_id, name: r.group_name })),
      };

      res.json(contact);
    }
  );
});

/* ======================
   CREATE CONTACT
====================== */
router.post("/", (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    city,
    state,
    country,
    zipcode,
    website,
    currency,
    language,
    GST
  } = req.body;

  if (!name || !email)
    return res.status(400).json({ message: "Name & Email required" });

  const { first_name, last_name } = splitName(name);

  const sql = `
    INSERT INTO contact
    (first_name,last_name,email,phone,address,city,state,country,zipcode,website,currency,language,GST)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [first_name,last_name,email,phone,address,city,state,country,zipcode,website,currency,language,GST],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(409).json({ message: "Email already exists" });
        return res.status(500).json(err);
      }
      res.status(201).json({ message: "Contact Added", id: result.insertId });
    }
  );
});

/* ======================
   UPDATE CONTACT
====================== */
router.put("/:id", (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    city,
    state,
    country,
    zipcode,
    website,
    currency,
    language,
    GST
  } = req.body;

  const { first_name, last_name } = name ? splitName(name) : {};

  const sql = `
    UPDATE contact SET
    first_name=?, last_name=?, email=?, phone=?, address=?, city=?, state=?,
    country=?, zipcode=?, website=?, currency=?, language=?, GST=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      state,
      country,
      zipcode,
      website,
      currency,
      language,
      GST,
      req.params.id
    ],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Contact Updated" });
    }
  );
});

/* ======================
   SOFT DELETE CONTACT
====================== */
router.delete("/:id", (req, res) => {
  db.query(
    "UPDATE contact SET deleted_at=NOW() WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Contact Deleted" });
    }
  );
});

module.exports = router;
