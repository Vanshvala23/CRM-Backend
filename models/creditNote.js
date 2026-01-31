const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  item_name: String,
  description: String,
  qty: Number,
  unit: String,
  rate: Number,
  tax: Number,
  amount: Number
});

const creditNoteSchema = new mongoose.Schema(
  {
    credit_note_number: { type: String, unique: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Contact" },

    bill_to: String,
    ship_to: String,
    estimate_number: String,
    estimate_date: Date,
    expiry_date: Date,
    tags: String,
    currency: { type: String, default: "₹" },
    status: { type: String, default: "Draft" },
    reference_number: String,
    sale_agent: String,

    discount_type: String,
    discount: Number,
    adjustment: Number,

    sub_total: Number,
    tax_rate: Number,
    tax_amount: Number,
    total: Number,

    admin_note: String,
    client_note: String,
    terms_and_conditions: String,

    items: [itemSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditNote", creditNoteSchema);
