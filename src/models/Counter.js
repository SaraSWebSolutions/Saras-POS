const mongoose = require("mongoose");

// Generic auto-increment counter used for invoice numbers, stock-in/out ids, etc.
const counterSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  }, // e.g. "invoice", "stockIn"
  seq: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Counter", counterSchema);
