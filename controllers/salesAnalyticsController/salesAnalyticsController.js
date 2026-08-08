const { prisma } = require("../../config/db");

/**
 * @desc    Get Daily Sales, Revenue, Payment Mode Breakup & Top Selling Products
 * @route   GET /api/shopProducts/dailySummary
 * @access  Private (ShopKeeper)
 */
const getDailySalesSummary = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    // Aaj ki start date (00:00:00.000) aur end date (23:59:59.999) calculate karein
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Aaj ki saari Sales Fetch Karein
    const todaysSales = await prisma.sale.findMany({
      where: {
        shopId: shopId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        saleItems: true,
      },
    });

    // 2. Metrics & Payment Mode Breakup Calculate Karein
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalItemsSold = 0;

    const paymentBreakup = {
      CASH: 0,
      UPI: 0,
      CARD: 0,
      CREDIT: 0,
    };

    todaysSales.forEach((sale) => {
      const saleAmount = parseFloat(sale.totalAmount);
      const discountAmount = parseFloat(sale.discount || 0);

      totalRevenue += saleAmount;
      totalDiscount += discountAmount;

      // Payment Mode Tally
      if (paymentBreakup[sale.paymentMode] !== undefined) {
        paymentBreakup[sale.paymentMode] += saleAmount;
      }

      // Total Quantity Tally
      sale.saleItems.forEach((item) => {
        totalItemsSold += item.quantity;
      });
    });

    // 3. Top 5 Best-Selling Products (Aaj ke)
    const topProductsRaw = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: {
        sale: {
          shopId: shopId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    // Top products ke Details (Name, Barcode) MasterProduct se Attach Karein
    const topProducts = await Promise.all(
      topProductsRaw.map(async (item) => {
        const product = await prisma.masterProduct.findUnique({
          where: { id: item.productId },
          select: { productName: true, barcode: true, mrp: true },
        });

        return {
          productId: item.productId,
          productName: product?.productName || "Unknown",
          barcode: product?.barcode || "",
          totalQuantitySold: item._sum.quantity,
        };
      })
    );

    // 4. Response Construct
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSalesCount: todaysSales.length, // Kitne bills bane
          totalRevenue: totalRevenue.toFixed(2), // Kitna paisa aaya
          totalDiscountGiven: totalDiscount.toFixed(2), // Kitna discount diya
          totalItemsSold: totalItemsSold, // Kitne products bike
          averageBillValue: todaysSales.length > 0 
            ? (totalRevenue / todaysSales.length).toFixed(2) 
            : "0.00",
        },
        paymentBreakup: {
          CASH: paymentBreakup.CASH.toFixed(2),
          UPI: paymentBreakup.UPI.toFixed(2),
          CARD: paymentBreakup.CARD.toFixed(2),
          CREDIT: paymentBreakup.CREDIT.toFixed(2),
        },
        topSellingProducts: topProducts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Daily sales analytics fetch karne mein issue aaya!",
      error: error.message,
    });
  }
};

module.exports = { getDailySalesSummary };