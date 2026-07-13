const mongoose = require("mongoose");

const stockHistorySchema = new mongoose.Schema(
  {
    refNo: {
      type: String,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      enum: ["in", "out", "adjustment", "sale", "refund"],
      required: true,
    },
    qty: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    reference: {
      type: String,
      default: "",
    }, // e.g. invoice number for sale/refund
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("StockHistory", stockHistorySchema);
