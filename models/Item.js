const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: String,
    long_description: String,
    rate: { type: Number, default: 0 },
    tax1: { type: Number, default: 0 },
    tax2: { type: Number, default: 0 },
    unit: String,
    item_group: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);
