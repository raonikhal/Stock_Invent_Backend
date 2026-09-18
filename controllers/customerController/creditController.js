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
        shopId: Number(shopId),
        totalDue: { gt: 0 },
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
 * @desc    Create Customer Udhaar Entry (Supports Direct Udhaar & Cart Bill Sales)
 * @route   POST /api/shopProducts/credit/create
 * @access  Private (ShopKeeper)
 */


// const createCustomerUdhaar = async (req, res) => {
//   try {
//     const shopId = req.user.shopId;

//     const {
//       customerName,
//       customerPhone,
//       totalAmount,
//       items = [], // Frontend cart items (if any)
//       note,
//     } = req.body;

//     const udhaarAmount = Number(totalAmount);
//     const cleanPhone = customerPhone?.toString().trim();
//     const cleanName = customerName?.trim();

//     // 1. Validation
//     if (
//       !cleanName ||
//       !cleanPhone ||
//       !Number.isFinite(udhaarAmount) ||
//       udhaarAmount <= 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Customer name, phone aur valid total amount required hai!",
//       });
//     }

//     // 2. Transaction Execution
//     const result = await prisma.$transaction(async (tx) => {
//       // Customer Upsert
//       const customer = await tx.customer.upsert({
//         where: {
//           shop_customer_phone_unique: {
//             shopId: Number(shopId),
//             phone: cleanPhone,
//           },
//         },
//         update: {
//           name: cleanName,
//           totalDue: {
//             increment: udhaarAmount,
//           },
//         },
//         create: {
//           shopId: Number(shopId),
//           name: cleanName,
//           phone: cleanPhone,
//           totalDue: udhaarAmount,
//         },
//       });

//       let createdSaleId = null;

//       // Agar items pass hue hain (Cart/Bill Checkout), to Sale & SaleItems create karein
//       if (Array.isArray(items) && items.length > 0) {
//         const sale = await tx.sale.create({
//           data: {
//             shopId: Number(shopId),
//             customerId: customer.id,
//             customerPhone: cleanPhone,
//             totalAmount: udhaarAmount,
//             paymentMode: "CREDIT",
//             saleItems: {
//               create: items.map((item) => ({
//                 itemName: String(item.itemName || item.name || "Item"),
//                 quantity: Number(item.quantity || 1),
//                 pricePerUnit: Number(item.pricePerUnit || item.price || 0),
//                 productId: item.productId ? Number(item.productId) : null,
//                 looseItemId: item.looseItemId ? Number(item.looseItemId) : null,
//                 batchId: item.batchId ? Number(item.batchId) : null,
//               })),
//             },
//           },
//         });
//         createdSaleId = sale.id;
//       }

//       // Udhaar Debit Entry create karna
//       const creditTxn = await tx.creditTransaction.create({
//         data: {
//           shopId: Number(shopId),
//           customerId: customer.id,
//           saleId: createdSaleId, // Linked Sale ID (if exists)
//           type: "DEBIT",
//           amount: udhaarAmount,
//           note: note || (createdSaleId ? "Bill Udhaar Sale" : "Direct Udhaar Sale"),
//         },
//       });

//       return {
//         customer,
//         creditTxn,
//       };
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Customer ka udhaar successfully create ho gaya!",
//       data: result,
//     });
//   } catch (error) {
//     console.error("Create Udhaar Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Customer udhaar create nahi ho saka!",
//       error: error.message,
//     });
//   }
// };


const createCustomerUdhaar = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const {
      customerName,
      customerPhone,
      totalAmount,
      items = [], // Frontend cart items (if any)
      note,
    } = req.body;

    const udhaarAmount = Number(totalAmount);
    const cleanPhone = customerPhone?.toString().trim();
    const cleanName = customerName?.trim();

    // 1. Validation
    if (
      !cleanName ||
      !cleanPhone ||
      !Number.isFinite(udhaarAmount) ||
      udhaarAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone aur valid total amount required hai!",
      });
    }

    // 2. Transaction Execution
    const result = await prisma.$transaction(async (tx) => {
      // Customer Upsert
      const customer = await tx.customer.upsert({
        where: {
          shop_customer_phone_unique: {
            shopId: Number(shopId),
            phone: cleanPhone,
          },
        },
        update: {
          name: cleanName,
          totalDue: {
            increment: udhaarAmount,
          },
        },
        create: {
          shopId: Number(shopId),
          name: cleanName,
          phone: cleanPhone,
          totalDue: udhaarAmount,
        },
      });

      // 🟢 FIX: Chahe direct udhaar ho ya cart bill, hamesha ek Sale record banega
      const hasItems = Array.isArray(items) && items.length > 0;

      const sale = await tx.sale.create({
        data: {
          shopId: Number(shopId),
          customerId: customer.id,
          customerPhone: cleanPhone,
          totalAmount: udhaarAmount,
          paymentMode: "CREDIT",
          saleItems: {
            create: hasItems
              ? items.map((item) => ({
                itemName: String(item.itemName || item.name || "Item"),
                quantity: Number(item.quantity || 1),
                pricePerUnit: Number(item.pricePerUnit || item.price || 0),
                productId: item.productId ? Number(item.productId) : null,
                looseItemId: item.looseItemId ? Number(item.looseItemId) : null,
                batchId: item.batchId ? Number(item.batchId) : null,
              }))
              : [
                // Direct/Manual Entry Item Fallback
                {
                  itemName: note || "Direct Udhaar Entry",
                  quantity: 1,
                  pricePerUnit: udhaarAmount,
                },
              ],
          },
        },
      });

      // Udhaar Debit Entry create karna
      const creditTxn = await tx.creditTransaction.create({
        data: {
          shopId: Number(shopId),
          customerId: customer.id,
          saleId: sale.id, // Linked Sale ID (Ab kabhi NULL nahi hoga)
          type: "DEBIT",
          amount: udhaarAmount,
          note: note || (hasItems ? "Bill Udhaar Sale" : "Direct Udhaar Sale"),
        },
      });

      return {
        customer,
        creditTxn,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Customer ka udhaar successfully create ho gaya!",
      data: result,
    });
  } catch (error) {
    console.error("Create Udhaar Error:", error);
    return res.status(500).json({
      success: false,
      message: "Customer udhaar create nahi ho saka!",
      error: error.message,
    });
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
            shopId: Number(shopId),
            phone: customerPhone,
          },
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            shopId: Number(shopId),
            phone: customerPhone,
            name: customerName || "Unknown Customer",
            totalDue: 0.0,
          },
        });
      }

      // 2. Customer ka totalDue balance decrement karein
      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalDue: { decrement: payAmount },
        },
      });

      // 3. Ledger Transaction Record add karein
      const creditTxn = await tx.creditTransaction.create({
        data: {
          shopId: Number(shopId),
          customerId: customer.id,
          type: "CREDIT",
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
    const { phone } = req.params;
    const shopId = req.user.shopId;

    // 1. Customer fetch karein
    const customer = await prisma.customer.findFirst({
      where: {
        phone: String(phone),
        shopId: Number(shopId),
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer nahi mila",
      });
    }

    // 2. Ledger History Fetch Karein Deep Include ke saath
    const ledgerHistory = await prisma.creditTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        sale: {
          include: {
            saleItems: {
              include: {
                looseItem: true,
                product: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        customerName: customer.name,
        phone: customer.phone,
        totalDue: customer.totalDue,
        ledgerHistory: ledgerHistory,
      },
    });
  } catch (error) {
    console.error("Ledger Fetch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

/**
 * @desc    Search Customers by Name or Phone
 * @route   GET /api/shopProducts/credit/search
 * @access  Private (ShopKeeper)
 */
const searchCustomers = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { query } = req.query;

    if (!query || String(query).trim() === "") {
      return res.status(200).json({ success: true, data: [] });
    }

    const searchQuery = String(query).trim();

    const customers = await prisma.customer.findMany({
      where: {
        shopId: Number(shopId),
        OR: [
          { phone: { contains: searchQuery } },
          { name: { contains: searchQuery } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        totalDue: true,
      },
      take: 5,
    });

    return res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Search API Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createCustomerUdhaar,
  getCreditCustomers,
  clearCustomerDue,
  getCustomerLedger,
  searchCustomers,
};