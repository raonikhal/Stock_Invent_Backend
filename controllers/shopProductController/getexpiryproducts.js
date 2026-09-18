const { prisma } = require("../../config/db");

const getExpiringItems = async (req, res) => {
  try {
    const shopId = req.user?.shopId; // Authenticated shop ID
    const daysAhead = parseInt(req.query.days) || 30; // Default 30 days window

    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: "Shop context missing in request",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date();
    targetDate.setDate(today.getDate() + daysAhead);
    targetDate.setHours(23, 59, 59, 999);

    // 1. Parallel Fetch: Master Inventory + Loose Items
    const [inventoryItems, looseItems] = await Promise.all([
      // Query A: Master Barcoded Inventory
      prisma.shopInventory.findMany({
        where: {
          shopId: shopId,
          batch: {
            expiryDate: {
              lte: targetDate, // Expired or expiring within N days
            },
          },
        },
        include: {
          batch: true,
          product: true,
        },
        orderBy: {
          batch: {
            expiryDate: 'asc',
          },
        },
      }),

      // Query B: Custom / Loose Items
      prisma.shopLooseItem.findMany({
        where: {
          shopId: shopId,
          expiryDate: {
            not: null,
            lte: targetDate, // Expired or expiring within N days
          },
        },
        orderBy: {
          expiryDate: 'asc',
        },
      }),
    ]);

    // 2. Format Master Inventory Items
    const formattedInventory = inventoryItems.map((item) => {
      const expDate = item.batch?.expiryDate ? new Date(item.batch.expiryDate) : null;
      const isExpired = expDate ? expDate < today : false;

      return {
        id: `INV_${item.id}`,
        originalId: item.id,
        type: 'INVENTORY',
        name: item.productName || item.product?.name || 'Unknown Item',
        barcode: item.barcode || 'N/A',
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        expiryDate: expDate,
        batchNumber: item.batch?.batchNumber || 'N/A',
        location: item.sectionName ? `${item.sectionName} - ${item.rackNumber || ''}` : 'N/A',
        status: isExpired ? 'EXPIRED' : 'EXPIRING_SOON',
      };
    });

    // 3. Format Loose Items
    const formattedLoose = looseItems.map((item) => {
      const expDate = item.expiryDate ? new Date(item.expiryDate) : null;
      const isExpired = expDate ? expDate < today : false;

      return {
        id: `LOOSE_${item.id}`,
        originalId: item.id,
        type: 'LOOSE',
        name: item.customName || 'Unknown Loose Item',
        barcode: item.customBarcode || 'N/A',
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        expiryDate: expDate,
        batchNumber: 'N/A', // Loose items usually don't have separate batch tracking
        location: item.sectionName ? `${item.sectionName} - ${item.rackNumber || ''}` : 'N/A',
        status: isExpired ? 'EXPIRED' : 'EXPIRING_SOON',
      };
    });

    // 4. Combine & Sort by Expiry Date (Ascending)
    const allExpiringItems = [...formattedInventory, ...formattedLoose].sort((a, b) => {
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate - b.expiryDate;
    });

    return res.status(200).json({
      success: true,
      count: allExpiringItems.length,
      data: allExpiringItems,
    });
  } catch (error) {
    console.error('Error fetching expiring items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch expiry items details',
      error: error.message,
    });
  }
};

module.exports = { getExpiringItems };