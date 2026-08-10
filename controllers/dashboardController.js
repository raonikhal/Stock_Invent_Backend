const { prisma } = require("../config/db");


const getDashboardSummary = async (req, res) => {
  try {
    // 1. Current Date Start & End Boundaries
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const phone = req.user?.phone;

    prisma.shop.findUnique({
      where:{
        phone : phone
      },

      select : {
        shopName : true,
        shopCode : true
      }
    }
    )

    // 2. Parallel Queries Execution
    const [
      shopDetails,
      uniqueShopProductsCount,
      godownStockSum,
      todaySoldSum,
      lowStockGroups
    ] = await Promise.all([

      // Query 1: Total Unique Products in Shop Inventory (Count unique productIds)
      prisma.shopInventory.groupBy({
        by: ['productId'],
      }),

      // Query 2: Total Quantity in Godown Inventory
      prisma.godownInventory.aggregate({
        _sum: {
          quantity: true,
        },
      }),

      // Query 3: Today's Total Sold Items Quantity from Sales
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

      // Query 4: Low Stock Items (Grouped by productId where sum of quantity <= 10 or reorderLevel)
      prisma.shopInventory.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
        },
        having: {
          quantity: {
            _sum: {
              lte: 10, // Stock <= 10 units
            },
          },
        },
      }),
    ]);

    // 3. Clean Response Format
    const stats = {
      shopCode = shopDetails.shopCode,
      shopName = shopDetails.shopName,
      shopTotalProducts: uniqueShopProductsCount.length || 0,// Array length gives total unique active items
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
