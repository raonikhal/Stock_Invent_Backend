// const { prisma } = require("../../config/db");
// const sharp = require('sharp');
// const path = require('path');
// const fs = require('fs');

// const createMasterProduct = async (req, res) => {
//   try {
//     const { barcode, productName, mrp, netWeight } = req.body;

//     console.log(barcode, productName, mrp, netWeight);

//     if (!barcode || !productName || !mrp || !netWeight) {
//       return res.status(400).json({ success: false, message: "Required fields missing!" });
//     }

//     // 1. Check karo ki Barcode pehle se MasterProduct mein exist toh nahi karta
//     const existingProduct = await prisma.masterProduct.findUnique({
//       where: { barcode: barcode }
//     });

//     if (existingProduct) {
//       return res.status(400).json({
//         success: false,
//         message: "Ye barcode pehle se Master Catalog mein exist karta hai!"
//       });
//     }

//     let imageUrl = null;

//     // 2. Image Compression Logic
//     if (req.file) {
//       const fileName = `product-${barcode}-${Date.now()}.webp`;
//       const outputPath = path.join(__dirname, '../../uploads/products', fileName);

//       await sharp(req.file.buffer)
//         .resize(800)
//         .webp({ 
//           quality: 75, 
//           effort : 6
//         })
//         .toFile(outputPath);

//       imageUrl = `/uploads/products/${fileName}`;
//     }

//     // 3. Create Record in DB
//     const newMasterProduct = await prisma.masterProduct.create({
//       data: {
//         barcode,
//         productName,
//         mrp: parseFloat(mrp),
//         netWeight: netWeight,
//         imageUrl: imageUrl
//       }
//     });

//     res.status(201).json({
//       success: true,
//       message: "Item Master Catalog mein add ho gaya!",
//       data: newMasterProduct
//     });

//   } catch (error) {
//     // 4. Handle Prisma Unique Constraint Error explicitly (Fallback Safety)
//     if (error.code === 'P2002') {
//       return res.status(400).json({
//         success: false,
//         message: "Duplicate entry: Barcode pehle se exists karta hai."
//       });
//     }

//     res.status(500).json({ success: false, error: error.message });
//   }
// };

// module.exports = { createMasterProduct };





const { prisma } = require("../../config/db");
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require("../../config/b2Config"); // B2 Config Import

const createMasterProduct = async (req, res) => {
  try {
    const { barcode, productName, mrp, netWeight } = req.body;

    if (!barcode || !productName || !mrp || !netWeight) {
      return res.status(400).json({ success: false, message: "Required fields missing!" });
    }

    // 1. Check duplicate barcode
    const existingProduct = await prisma.masterProduct.findUnique({
      where: { barcode: barcode }
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Ye barcode pehle se Master Catalog mein exist karta hai!"
      });
    }

    let imageUrl = null;

    // 2. Image Compression & Backblaze B2 Upload Logic
    if (req.file) {
      const compressedImageBuffer = await sharp(req.file.buffer)
        .resize(800)
        .webp({ quality: 75, effort: 6 })
        .toBuffer();

      // FIX 1: 'finalBarcode' ki jagah 'barcode' variable use karein
      const fileName = `Products/product-${barcode}-${Date.now()}.webp`;

      const uploadParams = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileName,
        Body: compressedImageBuffer,
        ContentType: 'image/webp',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // FIX 2: Correct Backblaze B2 Public URL Format
      const cleanEndpoint = process.env.B2_ENDPOINT.replace("https://", "").replace("http://", "");
      imageUrl = `https://${cleanEndpoint}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
    }

    // 3. Create Record in DB
    const newMasterProduct = await prisma.masterProduct.create({
      data: {
        barcode,
        productName,
        mrp: parseFloat(mrp),
        netWeight: netWeight,
        imageUrl: imageUrl
      }
    });

    res.status(201).json({
      success: true,
      message: "Item Master Catalog mein add ho gaya!",
      data: newMasterProduct
    });

  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry: Barcode pehle se exists karta hai."
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { createMasterProduct };