const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../../config/b2Config');
const { prisma } = require('../../config/db');

const uploadSaleBill = async (req, res) => {
  try {
    const { invoiceId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "PDF File missing!" });
    }

    // 📁 Folder name 'Bills' specify kiya gaya hai
    const fileName = `Bills/Invoice_${invoiceId || Date.now()}_${Date.now()}.pdf`;

    const uploadParams = {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: 'application/pdf',
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    const endpointHost = process.env.B2_ENDPOINT.replace("https://", "");
    const pdfUrl = `https://${process.env.B2_BUCKET_NAME}.${endpointHost}/${fileName}`;

    // Optional: Agar DB mein Sale record me bill link save karna ho
    if (invoiceId && invoiceId !== 'N/A') {
      await prisma.sale.update({
        where: { id: parseInt(invoiceId) },
        data: { receiptUrl: pdfUrl },
      }).catch(err => console.log("DB Skip:", err.message));
    }

    return res.status(200).json({
      success: true,
      message: "Bill PDF uploaded successfully",
      billUrl: pdfUrl,
    });
  } catch (error) {
    console.error("Bill upload error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { uploadSaleBill };