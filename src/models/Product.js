const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    barcode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    gstRate: {
      type: Number,
      default: 0,
    }, // percentage e.g. 5, 12, 18
    unit: {
      type: String,
      default: "pcs",
    }, // pcs, kg, ltr, etc.
    image: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

productSchema.index({ name: "text" });

module.exports = mongoose.model("Product", productSchema);
