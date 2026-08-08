const { prisma } = require("../../config/db");

const addProduct = async (req, res) => {
  try {
    const shopId = req.user?.shopId; // Authenticated Shop ID
    const { 
      barcode, 
      quantity, 
      batchNumber, 
      expiry, 
      sale_price, 
      mrp, 
      sectionName, 
      rackNumber, 
      isLoose,       // Flag for loose/custom item inward
      customName,
      netWeight,
      category,
      imageUrl       // Optional custom image for loose items
    } = req.body;

    // Common Base Validation
    if ((!barcode && !isLoose) || sale_price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Sale Price aur Barcode / Loose flag zaroori hain!"
      });
    }

    const addedQty = parseInt(quantity || 1);
    const customSellingPrice = parseFloat(sale_price);

    // =========================================================
    // CASE A: LOOSE / CUSTOM ITEM (Stored in ShopLooseItem Table)
    // =========================================================
    if (isLoose) {
      if (!customName) {
        return res.status(400).json({
          success: false,
          message: "Loose item add karne ke liye Product Name zaroori hai!"
        });
      }

      // Loose barcode generation if not provided
      const generatedBarcode = barcode ? barcode.trim() : `LOOSE-${Date.now().toString().slice(-6)}`;
      const customMrpVal = mrp ? parseFloat(mrp) : customSellingPrice;

      // Upsert in ShopLooseItem table (Multi-tenant unique key handling)
      const looseItem = await prisma.shopLooseItem.upsert({
        where: {
          shop_custom_barcode_unique: {
            shopId: shopId,
            customBarcode: generatedBarcode
          }
        },
        update: {
          quantity: { increment: addedQty },
          sellingPrice: customSellingPrice,
          mrp: customMrpVal,
          sectionName: sectionName || undefined,
          rackNumber: rackNumber || undefined,
          imageUrl: imageUrl || undefined,
          netWeight: netWeight || undefined,
          category: category || undefined
        },
        create: {
          shopId: shopId,
          customName: customName.trim(),
          customBarcode: generatedBarcode,
          category: category || "Loose Items",
          netWeight: netWeight || null,
          mrp: customMrpVal,
          sellingPrice: customSellingPrice,
          quantity: addedQty,
          sectionName: sectionName || null,
          rackNumber: rackNumber || null,
          imageUrl: imageUrl || null
        }
      });

      return res.status(201).json({
        success: true,
        message: `${looseItem.customName} (Loose Item) ₹${customSellingPrice} par Shop Inventory mein add ho gaya!`,
        data: looseItem
      });
    }

    // =========================================================
    // CASE B: STANDARD BARCODED PRODUCT (Linked with Master Catalog)
    // =========================================================

    // Additional validations for barcoded products
    if (!batchNumber || !expiry) {
      return res.status(400).json({
        success: false,
        message: "Standard products ke liye Batch Number aur Expiry Date zaroori hain!"
      });
    }

    const parsedExpiry = new Date(expiry);
    if (isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid Expiry Date format!"
      });
    }

    // 1. Search in Master Product Catalog
    const product = await prisma.masterProduct.findFirst({
      where: {
        OR: [
          { barcode: barcode.trim() },
          { cartonCode: barcode.trim() }
        ]
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Item Master Catalog mein nahi mila! Pehle ise Master Catalog mein add karein ya Loose Item flag set karein."
      });
    }

    // Discount Calculation relative to MRP
    const masterMrp = mrp ? parseFloat(mrp) : parseFloat(product.mrp);
    let calculatedDiscount = 0;
    if (masterMrp > customSellingPrice) {
      calculatedDiscount = ((masterMrp - customSellingPrice) / masterMrp) * 100;
    }

    // 2. Database Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {

      // STEP 1: Upsert Batch (Populate Barcode AND Product Name)
      const batch = await tx.productBatch.upsert({
        where: {
          shop_product_batch_unique: {
            shopId: shopId,
            productId: product.id,
            batchNumber: batchNumber.trim(),
          }
        },
        update: {
          barcode: product.barcode,       // 👈 Sync Barcode
          productName: product.productName, // 👈 Sync Product Name
          mrp: masterMrp,
          expiryDate: parsedExpiry
        },
        create: {
          shopId: shopId,
          productId: product.id,
          barcode: product.barcode,       // 👈 Direct Barcode
          productName: product.productName, // 👈 Direct Name
          batchNumber: batchNumber.trim(),
          expiryDate: parsedExpiry,
          mrp: masterMrp
        }
      });

      // STEP 2: Upsert Shop Inventory (Populate Barcode AND Product Name)
      const shopStock = await tx.shopInventory.upsert({
        where: {
          shop_product_batch_unique_inv: {
            shopId: shopId,
            productId: product.id,
            batchId: batch.id,
          }
        },
        update: {
          barcode: product.barcode,         // 👈 Sync Barcode for Ultra-Fast direct lookup
          productName: product.productName,   // 👈 Sync Name for instant UI render
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
          barcode: product.barcode,         // 👈 Save Barcode
          productName: product.productName,   // 👈 Save Name
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
              imageUrl: true,  // 👈 Frontend image display ke liye direct available
              netWeight: true,
              category: true
            }
          },
          batch: true
        }
      });

      return { shopStock, batch };
    });

    return res.status(200).json({
      success: true,
      message: `${result.shopStock.productName} (Batch: ${result.batch.batchNumber}) ₹${customSellingPrice} par Stock mein add ho gaya!`,
      data: result.shopStock
    });

  } catch (error) {
    console.error("Error in addProduct:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
};

module.exports = { addProduct };