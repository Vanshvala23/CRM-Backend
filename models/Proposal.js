const mongoose = require("mongoose");

const proposalItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  rate: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false }); // embedded, no separate _id

const proposalSchema = new mongoose.Schema({
  prop_id: { type: String, required: true, unique: true }, // #PROP0001
  subject: String,
  related: String,
  issue_date: Date,
  due_date: Date,
  currency: { type: String, default: "₹" },
  dis_type: { type: String, enum: ["Before", "After"], default: "After" },
  discount: { type: Number, default: 0 },
  status: { type: String, default: "Draft" },
  assign_to: String,
  to_: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zip_code: String,
  email: String,
  phone: String,
  subtotal: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  items: [proposalItemSchema]
}, { timestamps: true });

module.exports = mongoose.model("Proposal", proposalSchema);
