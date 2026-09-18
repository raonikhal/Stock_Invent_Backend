// const { prisma } = require("../config/db");

// const getDashboardSummary = async (req, res) => {
//   try {
//     // 1. JWT User Context (Prefer shopId directly if available in token, else fallback to phone)
//     let shopId = req.user?.shopId;
//     let shopDetails = null;

//     if (shopId) {
//       shopDetails = await prisma.shop.findUnique({
//         where: { id: shopId },
//         select: { id: true, shopCode: true, shopName: true, district: true },
//       });
//     } else if (req.user?.phone) {
//       shopDetails = await prisma.shop.findUnique({
//         where: { phone: req.user.phone },
//         select: { id: true, shopCode: true, shopName: true, district: true },
//       });
//       if (shopDetails) shopId = shopDetails.id;
//     }

//     if (!shopDetails || !shopId) {
//       return res.status(404).json({
//         success: false,
//         message: "Shop not found for authenticated user context",
//       });
//     }

//     // 2. Current Date Boundaries
//     const startOfToday = new Date();
//     startOfToday.setHours(0, 0, 0, 0);

//     const endOfToday = new Date();
//     endOfToday.setHours(23, 59, 59, 999);

//     // 3. Parallel Queries (Both Master Inventory + Loose Items)
//     const [
//       uniqueMasterProducts,
//       looseProductsCount,
//       uniqueGodownProducts,
//       todaySoldSum,
//       lowStockMaster,
//       lowStockLoose
//     ] = await Promise.all([

//       // Query 1A: Unique Master Barcoded Products in Shop Inventory
//       prisma.shopInventory.groupBy({
//         where: { shopId: shopId },
//         by: ['productId'],
//       }),

//       // Query 1B: Total Loose/Custom Unbarcoded Products
//       prisma.shopLooseItem.count({
//         where: { shopId: shopId },
//       }),

//       // Query 2: Unique Godown Products
//       prisma.godownInventory.groupBy({
//         where: {
//           godown: { shopId: shopId },
//         },
//         by: ['productId'],
//       }),

//       // Query 3: Today's Sold Quantity
//       prisma.saleItem.aggregate({
//         _sum: { quantity: true },
//         where: {
//           sale: {
//             shopId: shopId,
//             createdAt: { gte: startOfToday, lte: endOfToday },
//           },
//         },
//       }),

//       // Query 4A: Master Inventory Low Stock (lte 10)
//       prisma.shopInventory.groupBy({
//         where: { shopId: shopId },
//         by: ['productId'],
//         _sum: { quantity: true },
//         having: {
//           quantity: { _sum: { lte: 10 } },
//         },
//       }),

//       // Query 4B: Loose Items Low Stock (lte 10)
//       prisma.shopLooseItem.count({
//         where: {
//           shopId: shopId,
//           quantity: { lte: 10 },
//         },
//       }),
//     ]);

//     // Combined Counts
//     const totalShopProducts = (uniqueMasterProducts.length || 0) + (looseProductsCount || 0);
//     const totalLowStockAlerts = (lowStockMaster.length || 0) + (lowStockLoose || 0);

//     const stats = {
//       shopCode: shopDetails.shopCode || "N/A",
//       shopName: shopDetails.shopName || "My Shop",
//       district: shopDetails.district || "Unknown",
//       shopTotalProducts: totalShopProducts, // 👈 Barcoded + Loose both counted!
//       godownTotalProducts: uniqueGodownProducts.length || 0,
//       todaysSoldUnits: todaySoldSum._sum?.quantity || 0,
//       lowStockAlertsCount: totalLowStockAlerts,
//     };

//     return res.status(200).json({
//       success: true,
//       message: "Dashboard stats loaded successfully",
//       data: stats,
//     });

//   } catch (error) {
//     console.error("Dashboard API Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server Error while fetching dashboard stats",
//       error: error.message,
//     });
//   }
// };

// module.exports = { getDashboardSummary };


const { prisma } = require("../config/db");

const getDashboardSummary = async (req, res) => {
  try {
    // 1. JWT User Context (Prefer shopId directly, fallback to phone)
    let shopId = req.user?.shopId;
    let shopDetails = null;

    if (shopId) {
      shopDetails = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, shopCode: true, shopName: true, district: true },
      });
    } else if (req.user?.phone) {
      shopDetails = await prisma.shop.findUnique({
        where: { phone: req.user.phone },
        select: { id: true, shopCode: true, shopName: true, district: true },
      });
      if (shopDetails) shopId = shopDetails.id;
    }

    if (!shopDetails || !shopId) {
      return res.status(404).json({
        success: false,
        message: "Shop not found for authenticated user context",
      });
    }

    // 2. Date Boundaries
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 30 Days Target Date (Target for Expired + Expiring Soon)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(startOfToday.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    // 3. Parallel Queries Execution
    const [
      uniqueMasterProducts,
      looseProductsCount,
      expiringMasterCount,
      expiringLooseCount,
      todaySoldSum,
      lowStockMaster,
      lowStockLoose
    ] = await Promise.all([

      // Query 1A: Unique Master Barcoded Products in Shop Inventory
      prisma.shopInventory.groupBy({
        where: { shopId: shopId },
        by: ['productId'],
      }),

      // Query 1B: Total Loose/Custom Unbarcoded Products
      prisma.shopLooseItem.count({
        where: { shopId: shopId },
      }),

      // Query 2A: Expired / Expiring Master Inventory (via ProductBatch relation)
      prisma.shopInventory.count({
        where: {
          shopId: shopId,
          batch: {
            expiryDate: {
              lte: thirtyDaysFromNow, // Already expired OR expiring in next 30 days
            },
          },
        },
      }),

      // Query 2B: Expired / Expiring Loose Items
      prisma.shopLooseItem.count({
        where: {
          shopId: shopId,
          expiryDate: {
            not: null,
            lte: thirtyDaysFromNow, // Already expired OR expiring in next 30 days
          },
        },
      }),

      // Query 3: Today's Sold Quantity
      prisma.saleItem.aggregate({
        _sum: { quantity: true },
        where: {
          sale: {
            shopId: shopId,
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
        },
      }),

      // Query 4A: Master Inventory Low Stock (lte 10)
      prisma.shopInventory.groupBy({
        where: { shopId: shopId },
        by: ['productId'],
        _sum: { quantity: true },
        having: {
          quantity: { _sum: { lte: 10 } },
        },
      }),

      // Query 4B: Loose Items Low Stock (lte 10)
      prisma.shopLooseItem.count({
        where: {
          shopId: shopId,
          quantity: { lte: 10 },
        },
      }),
    ]);

    // Combined Counts Calculation
    const totalShopProducts = (uniqueMasterProducts.length || 0) + (looseProductsCount || 0);
    const totalLowStockAlerts = (lowStockMaster.length || 0) + (lowStockLoose || 0);
    const totalExpiringProductsCount = (expiringMasterCount || 0) + (expiringLooseCount || 0);

    const stats = {
      shopCode: shopDetails.shopCode || "N/A",
      shopName: shopDetails.shopName || "My Shop",
      district: shopDetails.district || "Unknown",
      shopTotalProducts: totalShopProducts,
      todaysSoldUnits: todaySoldSum._sum?.quantity || 0,
      lowStockAlertsCount: totalLowStockAlerts,
      expiringProductsCount: totalExpiringProductsCount, // 👈 Combined Count (Master + Loose)
    };

    return res.status(200).json({
      success: true,
      message: "Dashboard summary loaded successfully",
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