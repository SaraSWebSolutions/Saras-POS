const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    }, // selling price at time of adding
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    gstRate: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    }, // price * qty + gstAmount
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    items: [cartItemSchema],
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    discountType: {
      type: String,
      enum: ["flat", "percentage", "none"],
      default: "none",
    },
    discountValue: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "hold", "completed", "cancelled"],
      default: "active",
    },

    holdName: {
      type: String,
      default: "",
    }, // optional label when holding a bill
    cancelReason: {
      type: String,
      default: "",
    },

    invoiceNo: {
      type: String,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "split", null],
      default: null,
    },
    paymentDetails: {
      cashAmount: {
        type: Number,
        default: 0,
      },
      upiAmount: {
        type: Number,
        default: 0,
      },
      upiRefNo: {
        type: String,
        default: "",
      },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },

    isKOTGenerated: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Cart", cartSchema);
