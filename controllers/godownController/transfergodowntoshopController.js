const { prisma } = require("../../config/db");

/**
 * @desc    Transfer Stock from Godown to Shop Inventory
 * @route   POST /api/godown/transfer-to-shop
 * @access  Private (ShopKeeper)
 */
const transferGodownToShop = async (req, res) => {
  try {
    const shopId = req.user.shopId; // Authenticated user's shopId
    const {godownId, barcode, batchNumber, transferQuantity, sellingPrice, discount = 0, sectionName,
      rackNumber,
    } = req.body;

    // -------------------------------------------------------------
    // 1. INPUT VALIDATION
    // -------------------------------------------------------------
    if (!godownId || !barcode || !batchNumber || !transferQuantity) {
      return res.status(400).json({
        success: false,
        message: "godownId, barcode, batchNumber, aur transferQuantity required hain!",
      });
    }

    const qtyToTransfer = parseInt(transferQuantity);
    if (isNaN(qtyToTransfer) || qtyToTransfer <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive transfer quantity enter karein!",
      });
    }

    // -------------------------------------------------------------
    // 2. ATOMIC TRANSACTION (Deduct Godown + Add/Update Shop)
    // -------------------------------------------------------------
    const result = await prisma.$transaction(async (tx) => {

      // Step A: Master Product verify karein
      const masterProduct = await tx.masterProduct.findUnique({
        where: { barcode: String(barcode).trim() },
      });

      if (!masterProduct) {
        throw new Error(`Barcode '${barcode}' wala product Master Catalog mein nahi mila!`);
      }

      // Step B: Batch verify karein
      const batch = await tx.productBatch.findUnique({
        where: {
          shop_product_batch_unique: {
            shopId: shopId,
            productId: masterProduct.id,
            batchNumber: String(batchNumber).trim(),
          },
        },
      });

      if (!batch) {
        throw new Error(`Batch '${batchNumber}' is product ke liye exist nahi karta!`);
      }

      // Step C: Godown Inventory Stock Check
      const godownStock = await tx.godownInventory.findFirst({
        where: {
          godownId: parseInt(godownId),
          productId: masterProduct.id,
          batchId: batch.id,
        },
      });

      if (!godownStock) {
        throw new Error("Ye product/batch is Godown mein stock mein nahi hai!");
      }

      if (godownStock.quantity < qtyToTransfer) {
        throw new Error(
          `Godown mein insufficient stock! Available: ${godownStock.quantity}, Requested Transfer: ${qtyToTransfer}`
        );
      }

      // Step D: MINUS Stock from GodownInventory
      const updatedGodownStock = await tx.godownInventory.update({
        where: { id: godownStock.id },
        data: {
          quantity: { decrement: qtyToTransfer },
        },
      });

      // Step E: Price Decide Karein (Selling price pass nahi hua toh MRP use karenge)
      const finalSellingPrice = sellingPrice ? parseFloat(sellingPrice) : parseFloat(batch.mrp);

      // Step F: ADD / INCREMENT Stock in ShopInventory (Upsert approach)
      const shopStock = await tx.shopInventory.upsert({
        where: {
          shop_product_batch_unique_inv: {
            shopId: shopId,
            productId: masterProduct.id,
            batchId: batch.id,
          },
        },
        update: {
          quantity: { increment: qtyToTransfer },
          sellingPrice: finalSellingPrice,
          discount: parseFloat(discount),
          sectionName: sectionName || undefined,
          rackNumber: rackNumber || undefined,
        },
        create: {
          shopId: shopId,
          productId: masterProduct.id,
          batchId: batch.id,
          barcode: masterProduct.barcode,
          productName: masterProduct.productName,
          quantity: qtyToTransfer,
          sellingPrice: finalSellingPrice,
          discount: parseFloat(discount),
          sectionName: sectionName || null,
          rackNumber: rackNumber || null,
        },
        include: {
          product: { select: { productName: true, barcode: true } },
          batch: { select: { batchNumber: true, expiryDate: true, mrp: true } },
        },
      });

      return {
        transferredQty: qtyToTransfer,
        remainingGodownStock: updatedGodownStock.quantity,
        shopStock: shopStock,
      };
    });

    return res.status(200).json({
      success: true,
      message: `${result.transferredQty} units '${result.shopStock.productName}' Godown se Shop Inventory mein transfer ho gaye!`,
      data: result,
    });

  } catch (error) {
    console.error("Transfer Error:", error);
    return res.status(400).json({
      success: false,
      message: "Stock transfer fail ho gaya!",
      error: error.message,
    });
  }
};

module.exports = { transferGodownToShop };