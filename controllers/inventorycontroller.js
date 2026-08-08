const { prisma } = require("../config/db");

/**
 * @desc    Fetch Low Stock Items & Expiring Products (Alerts)
 * @route   GET /api/shopProducts/inventoryAlerts
 * @access  Private (ShopKeeper)
 */
const getInventoryAlerts = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const today = new Date();

    // 30 din baad ki expiry check karne ke liye date calculate karo
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // 1. Fetch Low Stock Items (quantity <= reorderLevel)
    const lowStockItems = await prisma.shopInventory.findMany({
      where: {
        shopId: shopId,
        quantity: {
          lte: prisma.shopInventory.fields.reorderLevel, // quantity <= reorderLevel
        },
      },
      include: { product: true },
    });

    // 2. Fetch Expiring Items (expiryDate <= 30 days from now)
    const expiringItems = await prisma.shopInventory.findMany({
      where: {
        shopId: shopId,
        batch: {
          expiryDate: {
            gte: new Date(),            // Aaj se
            lte: thirtyDaysFromNow,     // Agle 30 din ke andar tak
          },
        },
      },
      include: {
        product: true,
        batch: true, // 👈 Batch include karne se Expiry Date response mein bhi mil jayegi
      },
    });

    res.status(200).json({
      success: true,
      data: {
        lowStock: lowStockItems,
        expiring: expiringItems,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Inventory alerts fetch karne mein error!",
      error: error.message,
    });
  }
};

module.exports = { getInventoryAlerts };