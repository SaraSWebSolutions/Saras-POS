const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["low_stock", "order", "system", "payment", "general"],
      default: "general",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    forUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    }, // null = broadcast to all
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notification", notificationSchema);
