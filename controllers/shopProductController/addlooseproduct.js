// const sharp = require('sharp');
// const { prisma } = require("../../config/db");
// const path = require("path");
// const fs = require("fs");

// const addLooseProduct = async (req, res) => {
//   const shopId = req.user?.shopId;

//   console.log("loose product received");
//   console.log("Req File:", req.file);

//   try {
//     const {
//       customName,
//       totalQuantity,
//       unit,
//       pricePerUnit,
//       rackNumber,
//       sectionName,
//       isLoose,
//       expiryDate,
//     } = req.body;

//     // 1. Barcode generator ko pehle execute karo
//     const generateLooseBarcode = () => {
//       const random6Digits = Math.floor(100000 + Math.random() * 900000);
//       return `LOOSE-${random6Digits}`;
//     };
//     const finalBarcode = generateLooseBarcode();

//     // 2. Upload directory exist karti hai ya nahi verify karo
//     const uploadDir = path.join(__dirname, "../../uploads/products");
//     if (!fs.existsSync(uploadDir)) {
//       fs.mkdirSync(uploadDir, { recursive: true });
//     }

//     // 3. Image Compression & Save Logic
//     let imageUrl = null;
//     if (req.file) {
//       const fileName = `product-${finalBarcode}-${Date.now()}.webp`;
//       const outputPath = path.join(uploadDir, fileName);

//       await sharp(req.file.buffer)
//         .resize(800)
//         .webp({
//           quality: 75,
//           effort: 6,
//         })
//         .toFile(outputPath);

//       imageUrl = `/uploads/products/${fileName}`;
//     }

//     // 4. Schema mapping and calculations
//     const finalShopId = parseInt(shopId, 10) || req.user?.shopId || 1;
//     const weightWithUnit = totalQuantity && unit ? `${totalQuantity} ${unit}` : null;
//     const finalPrice = parseFloat(pricePerUnit);

//     // 5. Database Entry
//     const newLooseItem = await prisma.shopLooseItem.create({
//       data: {
//         shopId: finalShopId,
//         customBarcode: finalBarcode,
//         customName: customName,
//         netWeight: weightWithUnit,
//         sellingPrice: finalPrice,
//         quantity: parseInt(totalQuantity, 10) || 0,
//         imageUrl: imageUrl, // Fixed: imagePath ki jagah imageUrl
//         sectionName: sectionName || null,
//         rackNumber: rackNumber || null,
//       },
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Item successfully added to Loose Products!",
//       data: newLooseItem,
//     });
//   } catch (error) {
//     console.error("Error adding loose product:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while adding product",
//       error: error.message,
//     });
//   }
// };

// module.exports = { addLooseProduct };







const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { prisma } = require("../../config/db");
const s3Client = require("../../config/b2Config"); // B2 Config S3 Client Import Karein

const addLooseProduct = async (req, res) => {
  const shopId = req.user?.shopId;

  console.log("loose product received");
  console.log("Req File:", req.file);

  try {
    const {
      customName,
      totalQuantity,
      unit,
      pricePerUnit,
      rackNumber,
      sectionName,
      isLoose,
      expiryDate,
    } = req.body;

    // 1. Barcode generator
    const generateLooseBarcode = () => {
      const random6Digits = Math.floor(100000 + Math.random() * 900000);
      return `LOOSE-${random6Digits}`;
    };
    const finalBarcode = generateLooseBarcode();

    // 2. Image Compression (Sharp RAM Buffer) & Backblaze B2 Upload Logic
    let imageUrl = null;
    if (req.file) {
      // Step A: Sharp se compress karke direct RAM buffer nikalein (Disk file nahi banegi)
      const compressedImageBuffer = await sharp(req.file.buffer)
        .resize(800)
        .webp({
          quality: 75,
          effort: 6,
        })
        .toBuffer();

      // Product image key update
      const fileName = `Products/product-${finalBarcode}-${Date.now()}.webp`;


      // Step B: Backblaze B2 upload command set up karein
      const uploadParams = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileName,
        Body: compressedImageBuffer,
        ContentType: 'image/webp',
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Step C: Backblaze Public URL construct karein
      const endpointHost = process.env.B2_ENDPOINT.replace("https://", "");
      imageUrl = `https://${process.env.B2_BUCKET_NAME}.${endpointHost}/${fileName}`;
    }

    // 3. Schema mapping and calculations
    const finalShopId = parseInt(shopId, 10) || req.user?.shopId || 1;
    const weightWithUnit = totalQuantity && unit ? `${totalQuantity} ${unit}` : null;
    const finalPrice = parseFloat(pricePerUnit);

    // 4. Database Entry
    const newLooseItem = await prisma.shopLooseItem.create({
      data: {
        shopId: finalShopId,
        customBarcode: finalBarcode,
        customName: customName,
        netWeight: weightWithUnit,
        sellingPrice: finalPrice,
        quantity: parseInt(totalQuantity, 10) || 0,
        imageUrl: imageUrl, // Direct Backblaze S3 WebP Direct URL saved!
        sectionName: sectionName || null,
        rackNumber: rackNumber || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Item successfully added to Loose Products!",
      data: newLooseItem,
    });
  } catch (error) {
    console.error("Error adding loose product:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding product",
      error: error.message,
    });
  }
};

module.exports = { addLooseProduct };