const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { uploadDir } = require("../middleware/upload");

function fileUrl(req, filename) {
  return `${process.env.BASE_URL || `${req.protocol}://${req.get("host")}`}/uploads/${filename}`;
}

/**
 * Generates a simple tabular PDF report and saves it to /uploads.
 * columns: [{ key, label, width }]
 */
async function generatePdfReport(req, { title, columns, rows, filenamePrefix = "report" }) {
  const filename = `${filenamePrefix}-${Date.now()}.pdf`;
  const filePath = path.join(uploadDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(16).text(title, { align: "center" });
    doc.moveDown();

    const startX = doc.x;
    let y = doc.y;
    doc.fontSize(9).font("Helvetica-Bold");
    let x = startX;
    columns.forEach((col) => {
      doc.text(col.label, x, y, { width: col.width, continued: false });
      x += col.width;
    });
    doc.moveDown();
    doc.font("Helvetica");

    rows.forEach((row) => {
      y = doc.y;
      x = startX;
      if (y > 520) {
        doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
        y = doc.y;
      }
      columns.forEach((col) => {
        const value = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : "";
        doc.text(value, x, y, { width: col.width });
        x += col.width;
      });
      doc.moveDown(0.5);
    });

    doc.end();
    stream.on("finish", () => resolve({ filename, url: fileUrl(req, filename) }));
    stream.on("error", reject);
  });
}

/**
 * Generates an Excel report and saves it to /uploads.
 * columns: [{ key, header, width }]
 */
async function generateExcelReport(req, { title, columns, rows, filenamePrefix = "report" }) {
  const filename = `${filenamePrefix}-${Date.now()}.xlsx`;
  const filePath = path.join(uploadDir, filename);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title.substring(0, 30));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  await workbook.xlsx.writeFile(filePath);
  return { filename, url: fileUrl(req, filename) };
}

module.exports = { generatePdfReport, generateExcelReport, fileUrl };
