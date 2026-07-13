const Counter = require("../models/Counter");
const Settings = require("../models/Settings");

/**
 * Atomically increments and returns the next sequence number for a given key.
 */
async function nextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

/**
 * Builds the next invoice number using the prefix configured in Settings
 * (falls back to "INV" and pads the sequence to 4 digits).
 * Example: INV-0001
 */
async function nextInvoiceNumber() {
  const settings = await Settings.findOne();
  const prefix = settings?.billing?.invoicePrefix || "INV";
  const seq = await nextSequence("invoice");
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

async function nextStockRefNumber(type = "in") {
  const seq = await nextSequence(`stock_${type}`);
  const prefix = type === "in" ? "STIN" : type === "out" ? "STOUT" : "STADJ";
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

module.exports = { nextSequence, nextInvoiceNumber, nextStockRefNumber };
