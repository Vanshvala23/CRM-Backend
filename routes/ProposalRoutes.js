const express = require("express");
const router = express.Router();
const Proposal = require("../models/Proposal");
const PDFDocument = require("pdfkit");

/* =========================
   HELPER: Calculate Proposal
========================= */
function calculateProposal(items = [], discount = 0, dis_type) {
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

  if (dis_type === "Before") total_amount = subtotal - discount + totalTax;
  else if (dis_type === "After") total_amount -= discount;

  return { subtotal, total_amount, items };
}

/* =========================
   GET ALL PROPOSALS
========================= */
router.get("/", async (req, res) => {
  try {
    const proposals = await Proposal.find().sort({ createdAt: -1 });
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET SINGLE PROPOSAL
========================= */
router.get("/:prop_id", async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ prop_id: req.params.prop_id });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   CREATE PROPOSAL
========================= */
router.post("/", async (req, res) => {
  try {
    const data = req.body;

    // Generate prop_id
    const count = await Proposal.countDocuments();
    const prop_id = `#PROP${String(count + 1).padStart(4, "0")}`;

    // Calculate totals
    const { subtotal, total_amount, items } = calculateProposal(
      data.items || [],
      data.discount || 0,
      data.dis_type
    );

    const proposal = await Proposal.create({
      prop_id,
      ...data,
      subtotal,
      total_amount,
      items
    });

    res.status(201).json({ message: "Proposal created successfully", prop_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   DELETE PROPOSAL
========================= */
router.delete("/:prop_id", async (req, res) => {
  try {
    const result = await Proposal.findOneAndDelete({ prop_id: req.params.prop_id });
    if (!result) return res.status(404).json({ message: "Proposal not found" });
    res.json({ message: "Proposal deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GENERATE PROPOSAL PDF
========================= */
router.get("/:prop_id/pdf", async (req, res) => {
  try {
    const proposal = await Proposal.findOne({ prop_id: req.params.prop_id });
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const currency = proposal.currency || "₹";

    // Header
    doc.fontSize(22).fillColor("#1f2937").text("PROPOSAL", { align: "center" });
    doc.moveDown(1.5);
    doc.fontSize(10).fillColor("#374151");
    doc.text(`Proposal ID: ${proposal.prop_id}`, 40, 100);
    doc.text(`Status: ${proposal.status}`, 420, 100);
    doc.text(`Issue Date: ${proposal.issue_date?.toISOString().split('T')[0] || ''}`, 40, 115);
    doc.text(`Due Date: ${proposal.due_date?.toISOString().split('T')[0] || ''}`, 420, 115);

    doc.moveDown(2);

    // Client info
    doc.fontSize(11).fillColor("#111827");
    doc.text("Proposal To:", 40);
    doc.font("Helvetica-Bold").text(proposal.to_ || "-");
    doc.font("Helvetica");
    doc.moveDown(0.5);
    doc.text(proposal.address || "");
    doc.text(`${proposal.city || ""} ${proposal.state || ""} ${proposal.zip_code || ""}`);
    doc.text(proposal.country || "");
    doc.moveDown(0.5);
    doc.text(`Email: ${proposal.email || "-"}`);
    doc.text(`Phone: ${proposal.phone || "-"}`);

    doc.moveDown(2);

    // Items table
    const tableTop = doc.y;
    const col = { name: 40, qty: 260, rate: 330, tax: 400, total: 470 };
    doc.rect(40, tableTop, 520, 22).fill("#1f2937");
    doc.fillColor("#fff").fontSize(11);
    doc.text("Item", col.name, tableTop + 6);
    doc.text("Qty", col.qty, tableTop + 6);
    doc.text("Rate", col.rate, tableTop + 6);
    doc.text("Tax %", col.tax, tableTop + 6);
    doc.text("Total", col.total, tableTop + 6);

    let y = tableTop + 28;
    doc.fillColor("#000").fontSize(10);
    proposal.items.forEach(i => {
      doc.text(i.name, col.name, y);
      doc.text(i.quantity, col.qty, y);
      doc.text(`${currency}${i.rate}`, col.rate, y);
      doc.text(`${i.tax}%`, col.tax, y);
      doc.text(`${currency}${i.total}`, col.total, y);
      y += 20;
    });

    // Totals
    const totalsY = y + 10;
    doc.text("Sub Total:", 350, totalsY);
    doc.text(`${currency}${proposal.subtotal}`, 480, totalsY, { align: "right" });
    doc.text("Discount:", 350, totalsY + 15);
    doc.text(`${currency}${proposal.discount || 0}`, 480, totalsY + 15, { align: "right" });
    doc.font("Helvetica-Bold").text("Total Amount:", 350, totalsY + 35)
       .text(`${currency}${proposal.total_amount}`, 480, totalsY + 35, { align: "right" })
       .font("Helvetica");

    // Footer
    doc.fontSize(9).fillColor("#6b7280").text("This is a system generated proposal.", 40, 800, { align: "center" });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
