const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  hourly_rate: { type: Number, default: 0 },
  start_date: { type: Date, required: true },
  due_date: Date,
  priority: { type: String, default: "Low" },
  description: String,
  related_type: { type: String, enum: ["invoice","estimate","proposal","customer","lead"], default: null },
  related_id: { type: String, default: null },
  repeat_every: { type: Number, default: 0 },
  repeat_unit: { type: String, default: null },
  total_cycles: { type: Number, default: 0 },
  is_infinite: { type: Boolean, default: false },
  is_public: { type: Boolean, default: true },
  is_billable: { type: Boolean, default: false },
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);
