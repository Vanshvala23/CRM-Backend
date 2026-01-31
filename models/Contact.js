const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    first_name: String,
    last_name: String,
    email: { type: String, unique: true, required: true },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    zipcode: String,
    website: String,
    currency: String,
    language: String,
    GST: String,
    deleted_at: { type: Date, default: null },
    groups: [
      {
        id: String,
        name: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
