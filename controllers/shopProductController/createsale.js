const { prisma } = require("../../config/db");

/**
 * @desc    Create new Sale (POS Billing) & deduct Shop Inventory
 * @route   POST /api/shopProducts/createSale
 * @access  Private (ShopKeeper)
 */
const createSale = async (req, res) => {
    try {
        const shopId = req.user.shopId; // Extracted from JWT protect middleware
        const { items, paymentMode = "CASH", discount = 0, customerPhone, customerName } = req.body;

        // -------------------------------------------------------------
        // 1. INPUT VALIDATION
        // -------------------------------------------------------------
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart items array required hai aur empty nahi ho sakta!",
            });
        }

        if (!customerPhone || !customerName) {
            return res.status(400).json({
                success: false,
                message: "Customer ka phone number aur name Required hai!",
            });
        }

        const validPaymentModes = ["CASH", "UPI", "CARD", "CREDIT"];
        if (!paymentMode || !validPaymentModes.includes(paymentMode.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: `Valid payment mode select karein: ${validPaymentModes.join(", ")}`,
            });
        }

        // -------------------------------------------------------------
        // 2. PRISMA INTERACTIVE TRANSACTION
        // -------------------------------------------------------------
        const saleResult = await prisma.$transaction(
            async (tx) => {
                let calculatedGrandTotal = 0;
                const processedItems = [];

                // Step A: Process all Items & Check/Deduct Stock
                for (const item of items) {
                    const { productBarcode, quantity } = item;

                    if (!productBarcode || !quantity || quantity <= 0) {
                        throw new Error("Har item ka 'productBarcode' aur positive 'quantity' zaroori hai!");
                    }

                    // Master Product fetch karein
                    const masterProduct = await tx.masterProduct.findUnique({
                        where: { barcode: String(productBarcode) },
                    });

                    if (!masterProduct) {
                        throw new Error(`Barcode '${productBarcode}' wala product Master Catalog mein nahi mila!`);
                    }

                    // Shop Inventory Check Karein (Fetching Batch & Direct Pricing)
                    const stockItem = await tx.shopInventory.findFirst({
                        where: {
                            shopId: shopId,
                            productId: masterProduct.id,
                        },
                        include: {
                            batch: true
                        }
                    });

                    if (!stockItem) {
                        throw new Error(`Product '${masterProduct.productName}' aapki shop inventory mein added nahi hai!`);
                    }

                    if (stockItem.quantity < parseInt(quantity)) {
                        throw new Error(
                            `Insufficient Stock! '${masterProduct.productName}' ka available stock: ${stockItem.quantity}, requested: ${quantity}`
                        );
                    }

                    // Custom Selling Price from Shop Inventory (Falling back to Master MRP)
                    const unitPrice = parseFloat(stockItem.sellingPrice || masterProduct.mrp);
                    const itemTotal = unitPrice * parseInt(quantity);
                    calculatedGrandTotal += itemTotal;

                    // Deduct Stock
                    await tx.shopInventory.update({
                        where: { id: stockItem.id },
                        data: {
                            quantity: { decrement: parseInt(quantity) },
                        },
                    });

                    // Prepare Item for Sale Invoice
                    // FIX: Automatically attaching itemName from Database so Prisma validation succeeds!
                    processedItems.push({
                        productId: masterProduct.id,
                        batchId: stockItem.batchId || null,
                        itemName: stockItem.productName || masterProduct.productName, // 👈 Fix: itemName populated automatically!
                        quantity: parseInt(quantity),
                        pricePerUnit: unitPrice,
                    });
                }

                // Step B: Final Amount Calculation
                const finalAmount = Math.max(0, calculatedGrandTotal - parseFloat(discount));

                // Step C: Customer Upsert
                let customerRecord = null;
                if (customerPhone) {
                    customerRecord = await tx.customer.upsert({
                        where: {
                            shop_customer_phone_unique: {
                                shopId: shopId,
                                phone: customerPhone,
                            },
                        },
                        update: {
                            totalDue: paymentMode.toUpperCase() === "CREDIT" ? { increment: finalAmount } : undefined,
                        },
                        create: {
                            shopId: shopId,
                            phone: customerPhone,
                            name: customerName,
                            totalDue: paymentMode.toUpperCase() === "CREDIT" ? finalAmount : 0.00,
                        },
                    });
                }

                // Step D: Create Sale Invoice
                const saleInvoice = await tx.sale.create({
                    data: {
                        shopId: shopId,
                        customerId: customerRecord ? customerRecord.id : null,
                        totalAmount: finalAmount,
                        discount: parseFloat(discount),
                        paymentMode: paymentMode.toUpperCase(),
                        customerPhone: customerPhone || null,
                        saleItems: {
                            create: processedItems, // 👈 Holds the itemName internally
                        },
                    },
                    include: {
                        saleItems: {
                            include: {
                                product: {
                                    select: {
                                        productName: true,
                                        barcode: true,
                                        netWeight: true,
                                        imageUrl: true,
                                    },
                                },
                            },
                        },
                    },
                });

                // Step E: Create Ledger Entry if Credit Purchase
                if (paymentMode.toUpperCase() === "CREDIT" && customerRecord) {
                    await tx.creditTransaction.create({
                        data: {
                            shopId: shopId,
                            customerId: customerRecord.id,
                            saleId: saleInvoice.id,
                            type: "DEBIT", // Udhar Liya
                            amount: finalAmount,
                            note: `Bill #${saleInvoice.id} Credit Purchase`,
                        },
                    });
                }

                return saleInvoice;
            },
            {
                maxWait: 5000,
                timeout: 10000,
            }
        );

        // -------------------------------------------------------------
        // 3. SUCCESS RESPONSE
        // -------------------------------------------------------------
        res.status(201).json({
            success: true,
            message: "Sale completed & Stock updated successfully!",
            data: saleResult,
        });
    } catch (error) {
        console.error("Sale Processing Error:", error);
        res.status(400).json({
            success: false,
            message: "Sale processing failed!",
            error: error.message,
        });
    }
};

module.exports = { createSale };