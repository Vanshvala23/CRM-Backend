const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const Invoice = require("../models/Invoice");

/* ---------------- HELPERS ---------------- */

function generateInvNo(count) {
  return `#INV${String(count + 1).padStart(4, "0")}`;
}

function calculateInvoice(items, discount = 0, taxPercent = 0) {
  let subTotal = 0;

  items.forEach(item => {
    item.total = Number(item.price) * Number(item.quantity);
    subTotal += item.total;
  });

  const discountAmount = (subTotal * discount) / 100;
  const afterDiscount = subTotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const grandTotal = afterDiscount + taxAmount;

  return {
    sub_total: subTotal,
    discount: discountAmount,
    tax: taxAmount,
    total: grandTotal
  };
}

function numberToWords(num) {
  return `${num} Rupees Only`; // keep simple or reuse your old logic
}

/* ---------------- GET ALL ---------------- */
router.get("/", async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- GET SINGLE ---------------- */
router.get("/:inv_no", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ inv_no: req.params.inv_no });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- CREATE ---------------- */
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    const count = await Invoice.countDocuments();
    const invNo = generateInvNo(count);

    const calc = calculateInvoice(body.items, body.discount || 0, body.tax || 0);

    const invoice = await Invoice.create({
      ...body,
      inv_no: invNo,
      sub_total: calc.sub_total,
      discount: calc.discount,
      tax: calc.tax,
      total: calc.total,
      ammount_words: numberToWords(calc.total),
      items: body.items
    });

    res.status(201).json({ message: "Invoice Created", inv_no: invoice.inv_no });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- UPDATE ---------------- */
router.put("/:inv_no", async (req, res) => {
  try {
    const updated = await Invoice.findOneAndUpdate(
      { inv_no: req.params.inv_no },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Invoice not found" });

    res.json({ message: "Invoice Updated" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- DELETE ---------------- */
router.delete("/:inv_no", async (req, res) => {
  try {
    const deleted = await Invoice.findOneAndDelete({ inv_no: req.params.inv_no });

    if (!deleted) return res.status(404).json({ message: "Invoice not found" });

    res.json({ message: "Invoice Deleted" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- PDF ---------------- */
router.get("/:inv_no/pdf", async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ inv_no: req.params.inv_no });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=${invoice.inv_no}.pdf`
    );

    doc.pipe(res);

    const currency = invoice.currency || "₹";

    doc.fontSize(22).text("INVOICE", { align: "center" });
    doc.moveDown();

    doc.text(`Invoice #: ${invoice.inv_no}`);
    doc.text(`Status: ${invoice.status}`);
    doc.moveDown();

    doc.text(`Bill To: ${invoice.bill_to}`);
    doc.text(`Ship To: ${invoice.ship_to}`);
    doc.moveDown();

    invoice.items.forEach(item => {
      doc.text(
        `${item.name}  x${item.quantity}  = ${currency}${item.total}`
      );
    });

    doc.moveDown();
    doc.text(`Total: ${currency}${invoice.total}`);
    doc.text(`Amount in Words: ${invoice.ammount_words}`);

    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
