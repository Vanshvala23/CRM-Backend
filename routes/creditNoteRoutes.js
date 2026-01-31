const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const CreditNote = require("../models/creditNote");
const Contact = require("../models/COntact");
const PDFDocument = require("pdfkit");

/* ==============================
   GENERATE CREDIT NOTE NUMBER
============================== */
async function generateCreditNoteNumber() {
  const last = await CreditNote.findOne().sort({ createdAt: -1 });
  let next = 1;

  if (last && last.credit_note_number) {
    next = parseInt(last.credit_note_number.replace("CN-", "")) + 1;
  }

  return `CN-${String(next).padStart(6, "0")}`;
}

/* ==============================
   CREATE CREDIT NOTE
============================== */
router.post("/", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, discount_type, discount, adjustment, ...body } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ message: "Items required" });

    const credit_note_number = await generateCreditNoteNumber();

    let sub_total = 0;
    let tax_amount = 0;

    items.forEach((i) => {
      const amt = i.qty * i.rate;
      const taxRate = i.tax || 18;
      sub_total += amt;
      tax_amount += amt * (taxRate / 100);
      i.amount = amt + amt * (taxRate / 100);
    });

    let total = sub_total + tax_amount;

    if (discount_type === "Before tax" && discount)
      total = sub_total - discount + tax_amount;
    else if (discount_type === "After tax" && discount)
      total -= discount;

    total += Number(adjustment || 0);

    const creditNote = await CreditNote.create(
      [
        {
          ...body,
          credit_note_number,
          sub_total,
          tax_rate: 18,
          tax_amount,
          total,
          items
        }
      ],
      { session }
    );

    await session.commitTransaction();
    res.status(201).json({
      message: "Credit Note created",
      credit_note_number
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

/* ==============================
   GET ALL CREDIT NOTES
============================== */
router.get("/", async (req, res) => {
  try {
    const notes = await CreditNote.find()
      .populate("customer_id", "first_name last_name")
      .sort({ createdAt: -1 });

    const data = notes.map((n) => ({
      id: n._id,
      credit_note_number: n.credit_note_number,
      customer_name: `${n.customer_id?.first_name || ""} ${n.customer_id?.last_name || ""}`,
      estimate_number: n.estimate_number,
      estimate_date: n.estimate_date,
      total: n.total,
      status: n.status
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   GET SINGLE CREDIT NOTE
============================== */
router.get("/:id", async (req, res) => {
  try {
    const cn = await CreditNote.findById(req.params.id).populate(
      "customer_id",
      "first_name last_name"
    );

    if (!cn) return res.status(404).json({ message: "Not found" });

    res.json(cn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================
   DELETE CREDIT NOTE
============================== */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await CreditNote.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Not found" });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
