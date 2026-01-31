const mongoose = require("mongoose");

const customerGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  groups: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "CustomerGroup"
}]

}, { timestamps: true });

module.exports = mongoose.model("CustomerGroup", customerGroupSchema);
