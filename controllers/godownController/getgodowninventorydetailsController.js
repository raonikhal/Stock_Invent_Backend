const { prisma } = require("../../config/db");

/**
 * @desc    Get all available products & batch breakdown inside a Godown
 * @route   GET /api/v1/godown/:godownId/inventory
 * @access  Private (ShopKeeper)
 */
const getGodownInventoryDetails = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { godownId } = req.params;

    // 1. Validate Godown ID Parameter
    const parsedGodownId = parseInt(godownId, 10);
    if (!godownId || isNaN(parsedGodownId)) {
      return res.status(400).json({
        success: false,
        message: "URL param mein valid numeric godownId hona zaroori hai!",
      });
    }

    // 2. Check Godown Ownership
    const godown = await prisma.godown.findFirst({
      where: {
        id: parsedGodownId,
        shopId: shopId,
      },
    });

    if (!godown) {
      return res.status(404).json({
        success: false,
        message: "Godown nahi mila ya is shop se linked nahi hai!",
      });
    }

    // 3. Fetch Stock (FIXED: Used `prisma` instead of `tx`)
    const rawStock = await prisma.godownInventory.findMany({
      where: {
        godownId: parsedGodownId,
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            barcode: true,
            category: true,
            netWeight: true,
            imageUrl: true,
            mrp: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expiryDate: true,
            mrp: true,
          },
        },
      },
      orderBy: {
        batch: {
          expiryDate: "asc", // Subse pehle expire hone waale batches upar
        },
      },
    });

    // 4. Transform & Calculate Days Left For Expiry
    const currentDate = new Date();

    const formattedInventory = rawStock.map((item) => {
      const expiry = new Date(item.batch.expiryDate);
      const timeDiff = expiry.getTime() - currentDate.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

      return {
        inventoryId: item.id,
        productId: item.productId,
        productName: item.productName || item.product.productName,
        barcode: item.barcode || item.product.barcode,
        category: item.product.category,
        netWeight: item.product.netWeight,
        imageUrl: item.product.imageUrl,
        quantity: item.quantity,
        location: {
          sectionName: item.sectionName || "N/A",
          rackNumber: item.rackNumber || "N/A",
        },
        batchDetails: {
          batchId: item.batchId,
          batchNumber: item.batch.batchNumber,
          mrp: Number(item.batch.mrp),
          expiryDate: item.batch.expiryDate,
          daysUntilExpiry: daysUntilExpiry,
          isExpired: daysUntilExpiry <= 0,
          isExpiringSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 30, // 30 din ki alert limit
        },
      };
    });

    // 5. Global Summary Metrics Calculation
    const summary = formattedInventory.reduce(
      (acc, curr) => {
        acc.totalUnits += curr.quantity;
        acc.totalBatches += 1;
        if (curr.batchDetails.isExpired) acc.expiredBatchesCount += 1;
        if (curr.batchDetails.isExpiringSoon) acc.expiringSoonBatchesCount += 1;
        return acc;
      },
      {
        totalUnits: 0,
        totalBatches: 0,
        expiredBatchesCount: 0,
        expiringSoonBatchesCount: 0,
      }
    );

    return res.status(200).json({
      success: true,
      godown: {
        id: godown.id,
        godownName: godown.godownName,
        address: godown.address,
      },
      summary: summary,
      data: formattedInventory,
    });
  } catch (error) {
    console.error("Fetch Godown Stock Error:", error);
    return res.status(500).json({
      success: false,
      message: "Godown stock fetch karne mein error aaya!",
      error: error.message,
    });
  }
};

module.exports = { getGodownInventoryDetails };