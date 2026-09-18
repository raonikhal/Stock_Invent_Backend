const PDFDocument = require("pdfkit");

const generateInvoicePDF = (billData, shopData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [226, 600], margin: 10 }); // 80mm Thermal Receipt Size
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Shop Header
      doc.fontSize(12).font("Helvetica-Bold").text((shopData.shopName || "RETAIL STORE").toUpperCase(), { align: "center" });
      doc.fontSize(8).font("Helvetica").text(`Owner: ${shopData.ownerName || "Merchant"} | Ph: ${shopData.phone || "N/A"}`, { align: "center" });
      doc.moveDown(0.5);
      doc.text("------------------------------------------", { align: "center" });

      // Invoice Meta
      doc.fontSize(8).font("Helvetica-Bold").text(`INVOICE: #${billData.id}`);
      doc.text(`MODE: ${billData.paymentMode}`);
      doc.text(`DATE: ${new Date().toLocaleString("en-IN")}`);
      doc.text("------------------------------------------", { align: "center" });

      // Items Table Header
      doc.text("ITEM                     QTY    AMOUNT");
      doc.text("------------------------------------------", { align: "center" });

      // Items Loop
      billData.saleItems.forEach((item) => {
        const name = (item.itemName || "Item").substring(0, 15).padEnd(16, " ");
        const qty = `x${item.quantity}`.padEnd(6, " ");
        const amt = `₹${(item.pricePerUnit * item.quantity).toFixed(2)}`;
        doc.font("Helvetica").text(`${name} ${qty} ${amt}`);
      });

      doc.text("------------------------------------------", { align: "center" });
      doc.fontSize(10).font("Helvetica-Bold").text(`TOTAL AMOUNT: ₹${billData.totalAmount.toFixed(2)}`, { align: "right" });
      doc.text("------------------------------------------", { align: "center" });
      doc.fontSize(8).font("Helvetica").text("*** THANK YOU FOR YOUR VISIT ***", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoicePDF;