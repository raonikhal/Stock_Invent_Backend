const { prisma } = require("../../config/db");

/**
 * @desc    Get All Credit Customers with Total Pending Balance
 * @route   GET /api/shopProducts/credit/customers
 * @access  Private (ShopKeeper)
 */
const getCreditCustomers = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const customers = await prisma.customer.findMany({
      where: {
        shopId: shopId,
        totalDue: { gt: 0 }, // Sirf wahi jinpe udhar baki hai
      },
      orderBy: { totalDue: "desc" },
    });

    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * @desc    Pay / Clear Udhar Balance (Customer Settlement)
 * @route   POST /api/shopProducts/credit/pay
 * @access  Private (ShopKeeper)
 */
const clearCustomerDue = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { customerPhone, amount, note, customerName } = req.body;

    if (!customerPhone || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid customerPhone aur positive amount required hai!",
      });
    }

    const payAmount = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Customer fetch ya create karein
      let customer = await tx.customer.findUnique({
        where: {
          shop_customer_phone_unique: {
            shopId: shopId,
            phone: customerPhone,
          },
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            shopId: shopId,
            phone: customerPhone,
            name: customerName || "Unknown Customer",
            totalDue: 0.00,
          },
        });
      }

      // 2. Customer ka totalDue balance kam (decrement) karein
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalDue: { decrement: payAmount },
        },
      });

      // 3. Passbook / Ledger Transaction Record add karein
      const creditTxn = await tx.creditTransaction.create({
        data: {
          shopId: shopId,
          customerId: customer.id,
          type: "CREDIT", // Customer ne payment di
          amount: payAmount,
          note: note || "Payment Received",
        },
      });

      return { updatedCustomer, creditTxn };
    });

    res.status(200).json({
      success: true,
      message: `Rs. ${amount} payment successfully recorded!`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Payment record karne mein error aaya!",
      error: error.message,
    });
  }
};

/**
 * @desc    Get Specific Customer Ledger Passbook
 * @route   GET /api/shopProducts/credit/ledger/:phone
 * @access  Private (ShopKeeper)
 */
const getCustomerLedger = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { phone } = req.params;

    const customer = await prisma.customer.findUnique({
      where: {
        shop_customer_phone_unique: {
          shopId: shopId,
          phone: phone,
        },
      },
      include: {
        creditTxns: {
          orderBy: { createdAt: "desc" },
          include: {
            sale: {
              select: { id: true, totalAmount: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Is phone number ka koi customer record nahi mila!",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        customerName: customer.name,
        phone: customer.phone,
        totalDue: customer.totalDue,
        ledgerHistory: customer.creditTxns,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {getCreditCustomers, clearCustomerDue, getCustomerLedger};