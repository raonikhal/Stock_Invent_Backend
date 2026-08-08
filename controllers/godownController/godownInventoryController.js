const { prisma } = require("../../config/db");

/**
 * @desc    Add / Scan items into Godown Inventory
 * @route   POST /api/godown/add-stock
 * @access  Private (ShopKeeper)
 */
const addGodownStock = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { godownId, barcode, batchNumber, expiryDate, mrp, quantity = 1, sectionName, rackNumber } = req.body;

    // 1. Validation
    if (!godownId || !barcode || !batchNumber || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: "godownId, barcode, batchNumber aur expiryDate zaroori hain!"
      });
    }

    // 2. Check Godown ownership
    const godown = await prisma.godown.findFirst({
      where: { id: parseInt(godownId), shopId: shopId }
    });

    if (!godown) {
      return res.status(404).json({
        success: false,
        message: "Godown nahi mila ya is shop se linked nahi hai!"
      });
    }

    // 3. Find Product in Master Catalog
    const masterProduct = await prisma.masterProduct.findUnique({
      where: { barcode: String(barcode) }
    });

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: `Barcode '${barcode}' master catalog mein nahi mila!`
      });
    }

    // 4. Transaction: Upsert Batch & Update/Create Godown Inventory
    const result = await prisma.$transaction(async (tx) => {
      // Step A: Upsert Product Batch
      const batch = await tx.productBatch.upsert({
        where: {
          shop_product_batch_unique: {
            shopId: shopId,
            productId: masterProduct.id,
            batchNumber: String(batchNumber).trim(),
          }
        },
        update: {
          expiryDate: new Date(expiryDate),
          mrp: parseFloat(mrp || masterProduct.mrp),
          barcode: masterProduct.barcode,
          productName: masterProduct.productName
        },
        create: {
          shopId: shopId,
          productId: masterProduct.id,
          batchNumber: String(batchNumber).trim(),
          expiryDate: new Date(expiryDate),
          mrp: parseFloat(mrp || masterProduct.mrp),
          barcode: masterProduct.barcode,
          productName: masterProduct.productName
        }
      });

      // Step B: Check existing Godown Inventory entry
      const existingInv = await tx.godownInventory.findFirst({
        where: {
          godownId: parseInt(godownId),
          productId: masterProduct.id,
          batchId: batch.id
        }
      });

      let stock;
      if (existingInv) {
        stock = await tx.godownInventory.update({
          where: { id: existingInv.id },
          data: {
            quantity: { increment: parseInt(quantity) },
            sectionName: sectionName || existingInv.sectionName,
            rackNumber: rackNumber || existingInv.rackNumber,
          }
        });
      } else {
        stock = await tx.godownInventory.create({
          data: {
            godownId: parseInt(godownId),
            productId: masterProduct.id,
            batchId: batch.id,
            barcode: masterProduct.barcode,
            productName: masterProduct.productName,
            quantity: parseInt(quantity),
            sectionName: sectionName || null,
            rackNumber: rackNumber || null
          }
        });
      }

      // Step C: Fetch complete data including relations to return in response
      return await tx.godownInventory.findUnique({
        where: { id: stock.id },
        include: {
          godown: { select: { godownName: true } },
          product: { select: { productName: true, barcode: true, imageUrl: true } },
          batch: { select: { batchNumber: true, expiryDate: true, mrp: true } }
        }
      });
    });

    return res.status(200).json({
      success: true,
      message: "Godown stock successfully updated!",
      data: result
    });

  } catch (error) {
    console.error("Godown Stock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Stock add karne mein error aaya!",
      error: error.message
    });
  }
};

module.exports = { addGodownStock };