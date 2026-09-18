const { prisma } = require('../../config/db');

const getSaleDetails = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const shopId = req.user.shopId; // Authenticated shopkeeper

    const sale = await prisma.sale.findFirst({
      where: {
        id: Number(invoiceId),
        shopId: shopId,
      },
      include: {
        saleItems: true, // Receipt modal ke items render karne ke liye
      },
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale bill not found",
      });
    }

    return res.status(200).json({
      success: true,
      bill: sale,
    });
  } catch (error) {
    console.error("Get Sale Details Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};





/**
 * @desc    Fetch Sales History (Date-wise or Today's Sales)
 * @route   GET /api/shopProducts/sales/history
 * @query   date (optional YYYY-MM-DD, defaults to today)
 * @access  Private (Shopkeeper / Worker)
 */
const getSalesHistory = async (req, res) => {
  try {

    console.log("sales history fetched");
    const shopId = req.user.shopId; // Authenticated shop ID
    const { date } = req.query;

    // 1. Target Date Range Calculate Karein (Start of Day to End of Day)
    const targetDate = date ? new Date(date) : new Date();

    // Invalid date fallback check
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format provided! YYYY-MM-DD expected.",
      });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Fetch Sales with Prisma Include Relations
    const sales = await prisma.sale.findMany({
      where: {
        shopId: Number(shopId),
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        saleItems: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                barcode: true,
                mrp: true,
              },
            },
            looseItem: {
              select: {
                id: true,
                customName: true,
                customBarcode: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc", // Latest bills top par aayenge
      },
    });

    // 3. Daily Summary Stats Calculate Karein
    let totalCollection = 0;
    const formattedSales = sales.map((sale) => {
      const totalAmount = parseFloat(sale.totalAmount);
      totalCollection += totalAmount;

      return {
        id: sale.id,
        shopId: sale.shopId,
        totalAmount: totalAmount,
        finalAmount: totalAmount, // For Flutter Compatibility
        discount: sale.discount || 0,
        paymentMode: sale.paymentMode,
        isUdhaar: sale.paymentMode === "CREDIT",
        customerName: sale.customer?.name || "Walk-in Customer",
        customerPhone: sale.customerPhone || sale.customer?.phone || "",
        createdAt: sale.createdAt,
        receiptUrl: sale.receiptUrl,
        saleItems: sale.saleItems.map((item) => ({
          id: item.id,
          itemName:
            item.itemName ||
            item.product?.productName ||
            item.looseItem?.customName ||
            "Product Item",
          quantity: item.quantity,
          pricePerUnit: parseFloat(item.pricePerUnit),
          productId: item.productId,
          looseItemId: item.looseItemId,
        })),
      };
    });

    // 4. Final JSON Response
    return res.status(200).json({
      success: true,
      message: "Sales history fetched successfully",
      summary: {
        date: startOfDay.toISOString().split("T")[0],
        totalBills: formattedSales.length,
        totalCollection: totalCollection,
      },
      data: formattedSales,
    });
  } catch (error) {
    console.error("Error fetching sales history:", error);
    return res.status(500).json({
      success: false,
      message: "Sales history fetch karne mein server error aaya!",
      error: error.message,
    });
  }
};

module.exports = {
  getSaleDetails, getSalesHistory
};