const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  bill_type: { type: String, default: "Project hours" },
  status: { type: String, default: "Not started" },
  rate_per_hour: { type: Number, default: 0 },
  estimated_hour: { type: Number, default: 0 },
  start_date: Date,
  end_date: Date,
  tags: [String],
  description: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);
