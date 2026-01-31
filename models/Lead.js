const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: String,
  status: { type: String, default: "New" },
  source: String,
  assigned_to: String,
  tags: [String],
  position: String,
  email: String,
  website: String,
  phone: String,
  lead_value: { type: Number, default: 0 },
  company: String,
  description: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zipcode: String,
  default_language: { type: String, default: "System Default" },
  is_public: { type: Boolean, default: false },
  contacted_today: { type: Boolean, default: false },
  currency: { type: String, default: "USD" },
  converted_to_customer: { type: Boolean, default: false },
  deleted_at: Date
}, { timestamps: true });

module.exports = mongoose.model("Lead", leadSchema);
