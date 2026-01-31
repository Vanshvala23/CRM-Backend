const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  ticket_type: { type: String, enum: ["with_contact","without_contact"], required: true },
  subject: { type: String, required: true },

  // Contact info
  contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", default: null },
  name: { type: String, default: null },
  email: { type: String, default: null },

  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  priority: { type: String, enum: ["low","medium","high"], default: "medium" },
  status: { type: String, default: "Open" },
  cc: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
