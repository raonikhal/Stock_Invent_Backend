const { prisma } = require("../../config/db");

// Helper function local date YYYY-MM-DD format me lene ke liye
const getLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSalesSummary = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { filter = "weekly" } = req.query;

    const now = new Date();
    let startDate;
    let graphPointsCount;

    if (filter.toLowerCase() === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      graphPointsCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    } else {
      startDate = new Date();
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      graphPointsCount = 7;
    }

    // 1. Total Revenue & Total Orders
    const summary = await prisma.sale.aggregate({
      where: {
        shopId: shopId,
        createdAt: { gte: startDate },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalSales = Number(summary._sum.totalAmount || 0);
    const totalOrders = summary._count.id || 0;

    // 2. Fetch Sales Data
    const salesList = await prisma.sale.findMany({
      where: {
        shopId: shopId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const salesMap = {};
    salesList.forEach((item) => {
      // 🟢 Local timezone date string format
      const dateStr = getLocalDateString(new Date(item.createdAt));
      const amount = Number(item.totalAmount || 0);
      salesMap[dateStr] = (salesMap[dateStr] || 0) + amount;
    });

    const graphData = [];
    for (let i = 0; i < graphPointsCount; i++) {
      const tempDate = new Date(startDate);
      tempDate.setDate(startDate.getDate() + i);
      const dateStr = getLocalDateString(tempDate);
      graphData.push(salesMap[dateStr] || 0);
    }

    // 3. Top Products Raw Query
    const topProductsRaw = await prisma.$queryRaw`
      SELECT 
        si.product_id AS productId,
        mp.product_name AS productName,
        mp.barcode AS barcode,
        SUM(si.quantity) AS totalQuantity,
        SUM(si.quantity * si.price_per_unit) AS totalRevenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN master_products mp ON si.product_id = mp.id
      WHERE s.shop_id = ${shopId}
        AND s.created_at >= ${startDate}
        AND si.product_id IS NOT NULL
      GROUP BY si.product_id, mp.product_name, mp.barcode
      ORDER BY totalQuantity DESC
      LIMIT 5
    `;

    const topProducts = topProductsRaw.map((item) => ({
      productId: item.productId,
      productName: item.productName || "Unknown Product",
      barcode: item.barcode || "",
      totalQuantity: Number(item.totalQuantity || 0),
      totalRevenue: Number(item.totalRevenue || 0),
    }));

    return res.status(200).json({
      success: true,
      message: "Reports analytics fetched successfully",
      data: {
        totalSales,
        totalOrders,
        graphData,
        topProducts,
      },
    });
  } catch (error) {
    console.error("Daily Sales Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Analytics fetch error",
      error: error.message,
    });
  }
};

module.exports = { getSalesSummary };