const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    shopProfile: {
      shopName: {
        type: String,
        default: "My Shop",
      },
      ownerName: {
        type: String,
        default: "",
      },
      phone: {
        type: String,
        default: "",
      },
      email: {
        type: String,
        default: "",
      },
      address: {
        type: String,
        default: "",
      },
      logo: {
        type: String,
        default: "",
      },
      gstin: {
        type: String,
        default: "",
      },
    },
    tax: {
      gstEnabled: {
        type: Boolean,
        default: true,
      },
      gstRate: {
        type: Number,
        default: 5,
      },
      cgstRate: {
        type: Number,
        default: 2.5,
      },
      sgstRate: {
        type: Number,
        default: 2.5,
      },
    },
    billing: {
      invoicePrefix: {
        type: String,
        default: "INV",
      },
      currency: {
        type: String,
        default: "INR",
      },
      currencySymbol: {
        type: String,
        default: "₹",
      },
      roundOff: {
        type: Boolean,
        default: true,
      },
      allowNegativeStock: {
        type: Boolean,
        default: false,
      },
    },
    printer: {
      type: {
        type: String,
        enum: ["bluetooth", "usb", "network"],
        default: "bluetooth",
      },
      deviceName: {
        type: String,
        default: "",
      },
      width: {
        type: String,
        enum: ["58mm", "80mm"],
        default: "80mm",
      },
      autoPrint: {
        type: Boolean,
        default: false,
      },
    },
    about: {
      appVersion: {
        type: String,
        default: "1.0.0",
      },
      companyName: {
        type: String,
        default: "Saras POS",
      },
      supportEmail: {
        type: String,
        default: "support@saraspos.com",
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Settings", settingsSchema);
