const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  price: Number,
  total: Number
});

const invoiceSchema = new mongoose.Schema({
  inv_no: { type: String, unique: true },
  bill_to: String,
  ship_to: String,
  company_name: String,
  currency: { type: String, default: "INR" },
  issue_date: String,
  due_date: String,
  payment_method: String,

  sub_total: Number,
  tax: Number,
  discount: Number,
  total: Number,
  ammount_words: String,

  status: { type: String, default: "Draft" },
  terms_conditions: String,
  note: String,

  items: [itemSchema]
}, { timestamps: true });

module.exports = mongoose.model("Invoice", invoiceSchema);
