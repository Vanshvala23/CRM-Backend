const express = require("express");
const router = express.Router();
const db = require("../config/db");
const PDFDocument=require('pdfkit');
// ============================
// HELPER: Calculate Proposal
// ============================
function calculateProposal(items, discount = 0, dis_type) {
  let subtotal = 0;
  let totalTax = 0;

  items.forEach(item => {
    const price = Number(item.quantity) * Number(item.rate);
    const taxAmount = price * (Number(item.tax || 0) / 100);

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

// ============================
// GET ALL PROPOSALS
// ============================
router.get("/", async (req, res) => {
  try {
    const [proposals] = await db.query("SELECT * FROM proposal ORDER BY id DESC");
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// GET SINGLE PROPOSAL + ITEMS
// ============================
router.get("/:prop_id", async (req, res) => {
  try {
    const { prop_id } = req.params;

    const [proposal] = await db.query("SELECT * FROM proposal WHERE prop_id=?", [prop_id]);
    if (!proposal.length) return res.status(404).json({ message: "Proposal not found" });

    const [items] = await db.query("SELECT * FROM proposal_items WHERE prop_id=?", [prop_id]);
    res.json({ proposal: proposal[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================
// CREATE PROPOSAL + ITEMS
// ============================
router.post("/", async (req, res) => {
  const conn = await db.getConnection(); // Use transaction
  try {
    await conn.beginTransaction();

    const proposal = req.body;
    const { subtotal, total_amount, items } = calculateProposal(
      proposal.items,
      proposal.discount || 0,
      proposal.dis_type
    );

    // Generate Proposal ID
    const [count] = await conn.query("SELECT COUNT(*) AS total FROM proposal");
    const propId = `#PROP${String(count[0].total + 1).padStart(4, "0")}`;

    const sql = `
      INSERT INTO proposal (
        prop_id, subject, related, issue_date, due_date, currency,
        dis_type, status, assign_to, to_, address, city, state,
        country, zip_code, email, phone,
        subtotal, discount, total_amount
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const [result] = await conn.query(sql, [
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

    // Insert items
    const values = items.map(i => [
      propId,        // Use propId, not auto-increment id
      i.name || i.item_name,
      i.quantity,
      i.rate,
      i.tax || 0,
      i.price,
      i.total
    ]);

    await conn.query(
      `INSERT INTO proposal_items (prop_id, name, quantity, rate, tax, price, total) VALUES ?`,
      [values]
    );

    await conn.commit();
    res.status(201).json({ message: "Proposal Created Successfully", prop_id: propId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ============================
// DELETE PROPOSAL (CASCADE)
// ============================
router.delete("/:prop_id", async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Delete items first
    await conn.query("DELETE FROM proposal_items WHERE prop_id=?", [req.params.prop_id]);

    // Delete proposal
    const [result] = await conn.query("DELETE FROM proposal WHERE prop_id=?", [req.params.prop_id]);
    await db.query(`alter table proposal auto_increment =1`);
    if (!result.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ message: "Proposal not found" });
    }

    await conn.commit();
    res.json({ message: "Proposal Deleted Successfully" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ============================
// GENERATE PROPOSAL PDF
// ============================
router.get("/:prop_id/pdf", async (req, res) => {
  try {
    const { prop_id } = req.params;

    const [[proposal]] = await db.query(
      "SELECT * FROM proposal WHERE prop_id=?",
      [prop_id]
    );

    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    const [items] = await db.query(
      "SELECT * FROM proposal_items WHERE prop_id=?",
      [prop_id]
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const currency = proposal.currency || "₹";

    /* ================= HEADER ================= */
    doc
      .fontSize(22)
      .fillColor("#1f2937")
      .text("PROPOSAL", { align: "center" });

    doc.moveDown(1.5);

    doc.fontSize(10).fillColor("#374151");
    doc.text(`Proposal ID: ${proposal.prop_id}`, 40, 100);
    doc.text(`Status: ${proposal.status}`, 420, 100);
    doc.text(`Issue Date: ${proposal.issue_date}`, 40, 115);
    doc.text(`Due Date: ${proposal.due_date}`, 420, 115);

    doc.moveDown(2);

    /* ================= CLIENT INFO ================= */
    doc.fontSize(11).fillColor("#111827");
    doc.text("Proposal To:", 40);
    doc.font("Helvetica-Bold").text(proposal.to_ || "-");
    doc.font("Helvetica");

    doc.moveDown(0.5);
    doc.text(proposal.address || "");
    doc.text(
      `${proposal.city || ""} ${proposal.state || ""} ${proposal.zip_code || ""}`
    );
    doc.text(proposal.country || "");

    doc.moveDown(0.5);
    doc.text(`Email: ${proposal.email || "-"}`);
    doc.text(`Phone: ${proposal.phone || "-"}`);

    doc.moveDown(2);

    /* ================= ITEMS TABLE ================= */
    const tableTop = doc.y;
    const col = {
      name: 40,
      qty: 260,
      rate: 330,
      tax: 400,
      total: 470
    };

    doc.rect(40, tableTop, 520, 22).fill("#1f2937");
    doc.fillColor("#ffffff").fontSize(11);
    doc.text("Item", col.name, tableTop + 6);
    doc.text("Qty", col.qty, tableTop + 6);
    doc.text("Rate", col.rate, tableTop + 6);
    doc.text("Tax %", col.tax, tableTop + 6);
    doc.text("Total", col.total, tableTop + 6);

    let y = tableTop + 28;
    doc.fillColor("#000").fontSize(10);

    items.forEach(i => {
      doc.text(i.name, col.name, y);
      doc.text(i.quantity, col.qty, y);
      doc.text(`${currency}${i.rate}`, col.rate, y);
      doc.text(`${i.tax}%`, col.tax, y);
      doc.text(`${currency}${i.total}`, col.total, y);
      y += 20;
    });

    doc.moveDown(3);

    /* ================= TOTALS ================= */
    const totalsY = y + 10;

    doc.text("Sub Total:", 350, totalsY);
    doc.text(
      `${currency}${proposal.subtotal}`,
      480,
      totalsY,
      { align: "right" }
    );

    doc.text("Discount:", 350, totalsY + 15);
    doc.text(
      `${currency}${proposal.discount || 0}`,
      480,
      totalsY + 15,
      { align: "right" }
    );

    doc
      .font("Helvetica-Bold")
      .text("Total Amount:", 350, totalsY + 35)
      .text(
        `${currency}${proposal.total_amount}`,
        480,
        totalsY + 35,
        { align: "right" }
      )
      .font("Helvetica");

    /* ================= FOOTER ================= */
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text(
        "This is a system generated proposal.",
        40,
        800,
        { align: "center" }
      );

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
