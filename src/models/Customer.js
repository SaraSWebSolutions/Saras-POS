const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    totalPurchase: {
      type: Number,
      default: 0,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
    }, // reserved for future use
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

customerSchema.index({ name: "text", mobile: "text" });

module.exports = mongoose.model("Customer", customerSchema);
