const express = require("express");
const router = express.Router();
const db = require("../config/db");

/* ============================
   HELPER: Calculate Proposal
============================ */
function calculateProposal(items, discount = 0, dis_type) {
  let subtotal = 0;
  let totalTax = 0;

  items.forEach(item => {
    const price = Number(item.quantity) * Number(item.rate);
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

/* ============================
   GET ALL PROPOSALS
============================ */
router.get("/", async (req, res) => {
  try {
    const [proposals] = await db.promise().query(
      "SELECT * FROM proposal ORDER BY id DESC"
    );
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   GET SINGLE PROPOSAL + ITEMS
============================ */
router.get("/:prop_id", async (req, res) => {
  try {
    const { prop_id } = req.params;

    const [proposal] = await db.promise().query(
      "SELECT * FROM proposal WHERE prop_id=?",
      [prop_id]
    );

    if (!proposal.length) return res.status(404).json({ message: "Proposal not found" });

    const [items] = await db.promise().query(
      "SELECT * FROM proposal_items WHERE prop_id=?",
      [proposal[0].id]
    );

    res.json({ proposal: proposal[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   CREATE PROPOSAL + ITEMS
============================ */
router.post("/", async (req, res) => {
  try {
    const proposal = req.body;
    const { subtotal, total_amount, items } = calculateProposal(
      proposal.items,
      proposal.discount || 0,
      proposal.dis_type
    );

    // Generate Proposal ID
    const [count] = await db.promise().query("SELECT COUNT(*) AS total FROM proposal");
    const propId = `#PROP${String(count[0].total + 1).padStart(4, "0")}`;

    const sql = `
      INSERT INTO proposal (
        prop_id, subject, related, issue_date, due_date, currency,
        dis_type, status, assign_to, to_, address, city, state,
        country, zip_code, email, phone,
        subtotal, discount, total_amount
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const [result] = await db.promise().query(sql, [
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
    ]);

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

    await db.promise().query(
      `INSERT INTO proposal_items
       (prop_id, name, quantity, rate, tax, price, total) VALUES ?`,
      [values]
    );

    res.status(201).json({ message: "Proposal Created Successfully", prop_id: propId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   DELETE PROPOSAL (CASCADE)
============================ */
router.delete("/:prop_id", async (req, res) => {
  try {
    const [result] = await db.promise().query(
      "DELETE FROM proposal WHERE prop_id=?",
      [req.params.prop_id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ message: "Proposal not found" });

    res.json({ message: "Proposal Deleted Successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
