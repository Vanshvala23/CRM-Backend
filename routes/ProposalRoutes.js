const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ==========================
// Get All Proposals
// ==========================
router.get("/", (req, res) => {
  db.query("SELECT * FROM proposal ORDER BY id DESC", (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// ==========================
// Get Single Proposal + Items
// ==========================
router.get("/:prop_id", (req, res) => {
  const { prop_id } = req.params;

  db.query("SELECT * FROM proposal WHERE prop_id=?", [prop_id], (err, prop) => {
    if (err) return res.status(500).json(err);
    if (!prop.length) return res.status(404).json({ message: "Not found" });

    db.query(
      "SELECT * FROM proposal_items WHERE prop_id=?",
      [prop[0].id],
      (err, items) => {
        if (err) return res.status(500).json(err);

        res.json({
          proposal: prop[0],
          items
        });
      }
    );
  });
});

// ==========================
// Create Proposal + Items
// ==========================
router.post("/", (req, res) => {
  const proposal = req.body;

  const { subtotal, total_amount, items } = calculateProposal(
    proposal.items,
    proposal.discount || 0,
    proposal.dis_type
  );

  db.query("SELECT COUNT(*) AS total FROM proposal", (err, count) => {
    if (err) return res.status(500).json(err);

    const propId = `#PROP${String(count[0].total + 1).padStart(4, "0")}`;

    const sql = `
      INSERT INTO proposal (
        prop_id, subject, related, issue_date, due_date, currency,
        dis_type, status, assign_to, to_, address, city, state,
        country, zip_code, email, phone,
        subtotal, discount, total_amount
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    db.query(
      sql,
      [
        propId,
        proposal.subject,
        proposal.related,
        proposal.issue_date,
        proposal.due_date,
        proposal.currency,
        proposal.dis_type,
        proposal.status,
        proposal.assign_to,
        proposal.to_,
        proposal.address,
        proposal.city,
        proposal.state,
        proposal.country,
        proposal.zip_code,
        proposal.email,
        proposal.phone,
        subtotal,
        proposal.discount || 0,
        total_amount
      ],
      (err, result) => {
        if (err) return res.status(500).json(err);

        const proposalId = result.insertId;

        const values = items.map(i => [
          proposalId,
          i.name,
          i.quantity,
          i.rate,
          i.tax,
          i.price,
          i.total
        ]);

        db.query(
          `INSERT INTO proposal_items
          (prop_id, name, quantity, rate, tax, price, total) VALUES ?`,
          [values],
          err => {
            if (err) return res.status(500).json(err);

            res.status(201).json({
              message: "Proposal Created Successfully",
              prop_id: propId
            });
          }
        );
      }
    );
  });
});

// ==========================
// Delete Proposal (cascade)
// ==========================
router.delete("/:prop_id", (req, res) => {
  db.query(
    "DELETE FROM proposal WHERE prop_id=?",
    [req.params.prop_id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (!result.affectedRows)
        return res.status(404).json({ message: "Not found" });

      res.json({ message: "Proposal Deleted" });
    }
  );
});

module.exports = router;

// ==========================
// Calculation Helper
// ==========================
function calculateProposal(items, discount, dis_type) {
  let subtotal = 0;
  let totalTax = 0;

  items.forEach(item => {
    const price = item.quantity * item.rate;
    const taxAmount = price * (Number(item.tax) / 100);

    item.price = price;
    item.total = price + taxAmount;

    subtotal += price;
    totalTax += taxAmount;
  });

  let total_amount = subtotal + totalTax;

  if (dis_type === "Before") {
    total_amount = (subtotal - discount) + totalTax;
  } else if (dis_type === "After") {
    total_amount -= discount;
  }

  return { subtotal, total_amount, items };
}
