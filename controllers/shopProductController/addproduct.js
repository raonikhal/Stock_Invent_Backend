const { prisma } = require("../../config/db");

const addProduct = async (req, res) => {
  try {
    const shopId = req.user?.shopId; // Authenticated Shop ID

    if (!shopId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! Shop ID is missing.",
      });
    }

    const {
      barcode,
      quantity,
      batchNumber,
      expiry,
      sale_price,
      mrp,
      sectionName,
      rackNumber,
    } = req.body;

    // Common Validation: Barcode is required
    if (!barcode || !barcode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Barcode zaroori hai!",
      });
    }

    // Required fields check for Standard Products
    if (!batchNumber || !expiry) {
      return res.status(400).json({
        success: false,
        message: "Batch Number aur Expiry Date zaroori hain!",
      });
    }

    const parsedExpiry = new Date(expiry);
    if (isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expiry Date format!",
      });
    }

    // Numbers sanitization for Flutter/Mobile String & Number inputs
    const addedQty = parseInt(quantity || 1, 10);
    const customSellingPrice = parseFloat(sale_price || mrp || 0);

    // 1. Search in Master Product Catalog
    const product = await prisma.masterProduct.findFirst({
      where: {
        OR: [{ barcode: barcode.trim() }, { cartonCode: barcode.trim() }],
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Item Master Catalog mein nahi mila! Pehle ise Master Catalog mein add karein.",
      });
    }

    const cleanBatchNumber = batchNumber.trim();

    // Check duplicate batch for same product in this shop
    const existingSameBatchStock = await prisma.shopInventory.findFirst({
      where: {
        shopId: shopId,
        productId: product.id,
        batch: {
          batchNumber: cleanBatchNumber,
        },
      },
      include: {
        batch: true,
      },
    });

    if (existingSameBatchStock) {
      return res.status(400).json({
        success: false,
        message: `Is product (${product.productName}) ka Batch Number '${cleanBatchNumber}' pehle se inventory mein exist karta hai! Naya Batch Number enter karein.`,
      });
    }

    // Discount Calculation relative to MRP
    const masterMrp = mrp ? parseFloat(mrp) : parseFloat(product.mrp);
    let calculatedDiscount = 0;
    if (masterMrp > customSellingPrice && masterMrp > 0) {
      calculatedDiscount = ((masterMrp - customSellingPrice) / masterMrp) * 100;
    }

    // 2. Database Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.upsert({
        where: {
          shop_product_batch_unique: {
            shopId: shopId,
            productId: product.id,
            batchNumber: cleanBatchNumber,
          },
        },
        update: {
          barcode: product.barcode,
          productName: product.productName,
          mrp: masterMrp,
          expiryDate: parsedExpiry,
        },
        create: {
          shopId: shopId,
          productId: product.id,
          barcode: product.barcode,
          productName: product.productName,
          batchNumber: cleanBatchNumber,
          expiryDate: parsedExpiry,
          mrp: masterMrp,
        },
      });

      const shopStock = await tx.shopInventory.upsert({
        where: {
          shop_product_batch_unique_inv: {
            shopId: shopId,
            productId: product.id,
            batchId: batch.id,
          },
        },
        update: {
          barcode: product.barcode,
          productName: product.productName,
          quantity: { increment: addedQty },
          sellingPrice: customSellingPrice,
          discount: parseFloat(calculatedDiscount.toFixed(2)),
          sectionName: sectionName || undefined,
          rackNumber: rackNumber || undefined,
        },
        create: {
          shopId: shopId,
          productId: product.id,
          batchId: batch.id,
          barcode: product.barcode,
          productName: product.productName,
          quantity: addedQty,
          sellingPrice: customSellingPrice,
          discount: parseFloat(calculatedDiscount.toFixed(2)),
          sectionName: sectionName || null,
          rackNumber: rackNumber || null,
        },
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              barcode: true,
              imageUrl: true,
              netWeight: true,
              category: true,
            },
          },
          batch: true,
        },
      });

      return { shopStock, batch };
    });

    return res.status(200).json({
      success: true,
      message: `${result.shopStock.productName} (Batch: ${result.batch.batchNumber}) ₹${customSellingPrice} par Stock mein add ho gaya!`,
      data: result.shopStock,
    });
  } catch (error) {
    console.error("Error in addProduct:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = { addProduct };