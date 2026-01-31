const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  item_name: String,
  qty: Number,
  rate: Number,
  tax: Number,
  amount: Number
});

const estimateSchema = new mongoose.Schema({
  estimate_number: String,
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  bill_to: String,
  ship_to: String,
  issue_date: Date,
  expiry_date: Date,
  sub_total: Number,
  tax_rate: Number,
  tax_amount: Number,
  final_total: Number,
  terms_and_conditions: String,
  status: { type: String, default: 'Draft' },
  currency: String,
  discount_type: String,
  items: [itemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Estimate', estimateSchema);
