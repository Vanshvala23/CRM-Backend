const express = require("express");
const db = require("../config/db");
const router = express.Router();

/* ======================
   GET ALL CONTACTS
====================== */
router.get("/", (req, res) => {
  db.query(
    "SELECT * FROM contact WHERE deleted_at IS NULL",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

/* ======================
   GET SINGLE CONTACT
====================== */
// router.get("/:id", (req, res) => {
//   db.query(
//     "SELECT * FROM contact WHERE id=? AND deleted_at IS NULL",
//     [req.params.id],
//     (err, result) => {
//       if (err) return res.status(500).json(err);
//       if (result.length === 0) {
//         return res.status(404).json({ message: "Contact not found" });
//       }
//       res.json(result[0]);
//     }
//   );
// })
router.get("/:id", (req, res) => {
  db.query(
    `
    SELECT c.*, g.id AS group_id, g.name AS group_name
    FROM contact c
    LEFT JOIN customer_group_map cg ON c.id = cg.customer_id
    LEFT JOIN customer_groups g ON cg.group_id = g.id
    WHERE c.id = ?
    `,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: "Not found" });

      const contact = {
        ...rows[0],
        groups: rows
          .filter(r => r.group_id)
          .map(r => ({
            id: r.group_id,
            name: r.group_name
          }))
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

  if (!name || !email) {
    return res.status(400).json({ message: "Name & Email required" });
  }

  const sql = `
    INSERT INTO contact
    (name,email,phone,address,city,state,country,zipcode,website,currency,language,GST)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
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
    ],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "Email already exists" });
        }
        return res.status(500).json(err);
      }
      res.status(201).json({
        message: "Contact Added",
        id: result.insertId
      });
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

  const sql = `
    UPDATE contact SET
    name=?, email=?, phone=?, address=?, city=?, state=?, country=?,
    zipcode=?, website=?, currency=?, language=?, GST=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
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
      GST,
      req.params.id
    ],
    err => {
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
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Contact Deleted" });
    }
  );
});

module.exports = router;
