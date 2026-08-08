const { prisma } = require("../../config/db");
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const createMasterProduct = async (req, res) => {
  try {
    const { barcode, productName, mrp, netWeight } = req.body;

    if (!barcode || !productName || !mrp || !netWeight) {
      return res.status(400).json({ success: false, message: "Required fields missing!" });
    }

    let imageUrl = null;

    // --- Image Compression Logic ---
    if (req.file) {
      const fileName = `product-${barcode}-${Date.now()}.webp`;
      const outputPath = path.join(__dirname, '../../uploads/products/', fileName);

      // Sharp library se image ko WebP format mein 80% quality par compress karein
      await sharp(req.file.buffer)
        .resize(800) // Max width 800px (retina mobile screens ke liye enough hai)
        .webp({ quality: 75 }) // Heavy compression with high visual quality
        .toFile(outputPath);

      imageUrl = `/uploads/products/${fileName}`;
    }

    // --- Database Entry in MasterProduct ---
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
      message: "Item Master Catalog mein add ho gaya! Ab aap ise scan karke stock feed kar sakte hain.",
      data: newMasterProduct
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


module.exports = { createMasterProduct };