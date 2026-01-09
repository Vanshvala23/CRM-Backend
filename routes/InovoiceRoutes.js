const express = require("express");
const router = express.Router();
const db = require("../config/db"); // mysql2/promise connection
const PDFDocument = require('pdfkit');
// --------------------------
// Helpers
// --------------------------
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
    sub_total: subTotal.toFixed(2),
    discount: discountAmount.toFixed(2),
    tax: taxAmount.toFixed(2),
    total: grandTotal.toFixed(2)
  };
}

function numberToWords(num) {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num) {
    if ((num = num.toString()).length > 9) return "Overflow";

    let n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return;

    let str = "";
    str += n[1] != 0 ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + " Crore " : "";
    str += n[2] != 0 ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + " Lakh " : "";
    str += n[3] != 0 ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + " Thousand " : "";
    str += n[4] != 0 ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + " Hundred " : "";
    str += n[5] != 0 ? ((str != "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]]) : "";
    return str.trim();
  }

  return inWords(Math.floor(num)) + " Rupees Only";
}

// --------------------------
// Get all invoices
// --------------------------
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM invoice");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// Get single invoice + items
// --------------------------
router.get("/:inv_no", async (req, res) => {
  try {
    const { inv_no } = req.params;

    const [invoiceRows] = await db.query(
      "SELECT * FROM invoice WHERE inv_no=?",
      [inv_no]
    );
    if (!invoiceRows.length) return res.status(404).json({ message: "Invoice not found" });

    const [items] = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id=?",
      [invoiceRows[0].id]
    );

    res.json({ invoice: invoiceRows[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// Create invoice + items
// --------------------------
router.post("/", async (req, res) => {
  try {
    const invoice = req.body;

    // Count invoices to generate invoice number
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM invoice");
    const invNo = generateInvNo(total);

    const calc = calculateInvoice(invoice.items, invoice.discount || 0, invoice.tax || 0);

    const sql = `
      INSERT INTO invoice 
      (inv_no, bill_to, ship_to, company_name, currency,
       issue_date, due_date, payment_method,
       sub_total, tax, discount, total, ammount_words, status,
       terms_conditions, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    const [result] = await db.query(sql, [
      invNo,
      invoice.bill_to,
      invoice.ship_to,
      invoice.company_name,
      invoice.currency || "INR",
      invoice.issue_date,
      invoice.due_date,
      invoice.payment_method,
      calc.sub_total,
      calc.tax,
      calc.discount,
      calc.total,
      numberToWords(calc.total),
      invoice.status || "Draft",
      invoice.terms_conditions,
      invoice.note
    ]);

    const invoiceId = result.insertId;
    const values = invoice.items.map(item => [invoiceId, item.name, item.quantity, item.price, item.total]);

    await db.query(
      "INSERT INTO invoice_items (invoice_id, name, quantity, price, total) VALUES ?",
      [values]
    );

    res.status(201).json({ message: "Invoice Created Successfully", inv_no: invNo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// Update invoice
// --------------------------
router.put("/:inv_no", async (req, res) => {
  try {
    const { inv_no } = req.params;
    const invoice = req.body;

    const [result] = await db.query(
      "UPDATE invoice SET ? WHERE inv_no=?",
      [invoice, inv_no]
    );

    if (!result.affectedRows) return res.status(404).json({ message: "Invoice not found" });
    res.json({ message: "Invoice Updated Successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// Delete invoice
// --------------------------
router.delete("/:inv_no", async (req, res) => {
  try {
    const { inv_no } = req.params;
    const [result] = await db.query("DELETE FROM invoice WHERE inv_no=?", [inv_no]);
    await db.query(`alter table invoice auto_increment =1`);
    if (!result.affectedRows) return res.status(404).json({ message: "Invoice not found" });
    res.json({ message: "Invoice Deleted Successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------
// Invoice PDF (Professional UI)
// --------------------------
router.get("/:inv_no/pdf", async (req, res) => {
  try {
    const { inv_no } = req.params;

    const [[invoice]] = await db.query(
      "SELECT * FROM invoice WHERE inv_no=?",
      [inv_no]
    );
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const [items] = await db.query(
      "SELECT * FROM invoice_items WHERE invoice_id=?",
      [invoice.id]
    );

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    const currency = invoice.currency || "₹";

    /* ================= HEADER ================= */
    doc
      .fontSize(22)
      .fillColor("#1f2937")
      .text("INVOICE", { align: "center" });

    doc.moveDown(1.5);

    doc.fontSize(10).fillColor("#374151");
    doc.text(`Invoice #: ${invoice.inv_no}`, 40, 100);
    doc.text(`Status: ${invoice.status}`, 420, 100);
    doc.text(`Issue Date: ${invoice.issue_date}`, 40, 115);
    doc.text(`Due Date: ${invoice.due_date}`, 420, 115);

    doc.moveDown(2);

    /* ================= BILL TO ================= */
    doc.fontSize(11).fillColor("#111827");
    doc.text("Bill To:", 40);
    doc.font("Helvetica-Bold").text(invoice.bill_to);
    doc.font("Helvetica");

    doc.moveDown();

    doc.text("Ship To:", 320, 165);
    doc.font("Helvetica-Bold").text(invoice.ship_to || "-", 320);
    doc.font("Helvetica");

    doc.moveDown(2);

    /* ================= ITEMS TABLE ================= */
    const tableTop = doc.y;
    const col = { name: 40, qty: 260, rate: 330, amount: 440 };

    doc
      .rect(40, tableTop, 520, 20)
      .fill("#1f2937");

    doc
      .fillColor("#ffffff")
      .fontSize(11)
      .text("Item", col.name, tableTop + 5)
      .text("Qty", col.qty, tableTop + 5)
      .text("Rate", col.rate, tableTop + 5)
      .text("Amount", col.amount, tableTop + 5);

    let y = tableTop + 25;
    doc.fillColor("#000");

    items.forEach(i => {
      doc
        .fontSize(10)
        .text(i.name, col.name, y)
        .text(i.quantity, col.qty, y)
        .text(`${currency}${i.price}`, col.rate, y)
        .text(`${currency}${i.total}`, col.amount, y);
      y += 20;
    });

    doc.moveDown(3);

    /* ================= TOTALS ================= */
    const totalsY = y + 10;

    doc.text("Sub Total:", 360, totalsY);
    doc.text(`${currency}${invoice.sub_total}`, 460, totalsY, { align: "right" });

    doc.text("Discount:", 360, totalsY + 15);
    doc.text(`${currency}${invoice.discount}`, 460, totalsY + 15, { align: "right" });

    doc.text("Tax:", 360, totalsY + 30);
    doc.text(`${currency}${invoice.tax}`, 460, totalsY + 30, { align: "right" });

    doc
      .font("Helvetica-Bold")
      .text("Total:", 360, totalsY + 50)
      .text(`${currency}${invoice.total}`, 460, totalsY + 50, { align: "right" })
      .font("Helvetica");

    doc.moveDown(4);

    /* ================= NOTES ================= */
    if (invoice.note) {
      doc.fontSize(11).text("Note:", { underline: true });
      doc.fontSize(10).text(invoice.note);
      doc.moveDown();
    }

    if (invoice.terms_conditions) {
      doc.fontSize(11).text("Terms & Conditions:", { underline: true });
      doc.fontSize(10).text(invoice.terms_conditions);
    }

    /* ================= FOOTER ================= */
    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Thank you for your business!", 40, 800, {
        align: "center"
      });

    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
