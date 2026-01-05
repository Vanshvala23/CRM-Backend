const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Get all groups
router.get("/", (req, res) => {
  db.query("SELECT * FROM customer_groups", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// Create new group
router.post("/", (req, res) => {
  db.query(
    "INSERT INTO customer_groups (name) VALUES (?)",
    [req.body.name],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "Group already exists" });
        }
        return res.status(500).json(err);
      }
      res.status(201).json({ id: result.insertId, name: req.body.name });
    }
  );
});

// ✅ ASSIGN GROUP(S) TO CUSTOMER
router.post("/assign", (req, res) => {
  const { customer_id, group_ids } = req.body;

  if (!customer_id || !group_ids?.length) {
    return res.status(400).json({ message: "Invalid data" });
  }

  const values = group_ids.map(gid => [customer_id, gid]);

  db.query(
    "INSERT IGNORE INTO customer_group_map (customer_id, group_id) VALUES ?",
    [values],
    err => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Group(s) assigned successfully" });
    }
  );
});

module.exports = router;
