const { prisma } = require("../config/db");

const getDashboardSummary = async (req, res) => {
  try {
    // 1. Current Date Start & End Boundaries
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const phone = req.user?.phone;

    // 2. Parallel Queries Execution (Shop Query ko Promise.all ke andar shift kiya)
    const [
      shopDetails,
      uniqueShopProductsCount,
      godownStockSum,
      todaySoldSum,
      lowStockGroups
    ] = await Promise.all([

      // Query 1: Fetch Shop Details by User Phone Number
      phone 
        ? prisma.shop.findUnique({
            where: { phone: phone },
            select: {
              shopName: true,
              shopCode: true,
              district: true,
            },
          })
        : null,

      // Query 2: Total Unique Products in Shop Inventory
      prisma.shopInventory.groupBy({
        by: ['productId'],
      }),

      // Query 3: Total Quantity in Godown Inventory
      prisma.godownInventory.aggregate({
        _sum: {
          quantity: true,
        },
      }),

      // Query 4: Today's Total Sold Items Quantity from Sales
      prisma.saleItem.aggregate({
        _sum: {
          quantity: true,
        },
        where: {
          sale: {
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
        },
      }),

      // Query 5: Low Stock Items
      prisma.shopInventory.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
        },
        having: {
          quantity: {
            _sum: {
              lte: 10,
            },
          },
        },
      }),
    ]);

    // 3. Clean Response Format (Fixed ':' and Optional Chaining '?')
    const stats = {
      shopCode: shopDetails?.shopCode || "N/A",
      shopName: shopDetails?.shopName || "My Shop",
      district: shopDetails?.district || "Unknown",
      shopTotalProducts: uniqueShopProductsCount.length || 0,
      godownStockUnits: godownStockSum._sum?.quantity || 0,
      todaysSoldUnits: todaySoldSum._sum?.quantity || 0,
      lowStockAlertsCount: lowStockGroups.length || 0,
    };

    return res.status(200).json({
      success: true,
      message: "Dashboard stats loaded successfully",
      data: stats,
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error while fetching dashboard stats",
      error: error.message,
    });
  }
};

module.exports = { getDashboardSummary };
