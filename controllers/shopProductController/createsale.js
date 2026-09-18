// const { prisma } = require("../../config/db");
// const { PutObjectCommand } = require("@aws-sdk/client-s3");
// const s3Client = require("../../config/b2Config");
// const generateInvoicePDF = require("../../utils/pdfGenerator");
// const { sendAndSaveNotification } = require("../../services/notificationservices"); 

// const createSale = async (req, res) => {
//   try {
//     const shopId = req.user.shopId;
//     const {
//       items,
//       paymentMode = "CASH",
//       discount = 0,
//       customerName = null,
//       customerPhone = null
//     } = req.body;

//     if (!items || !Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Cart items array required hai aur empty nahi ho sakta!",
//       });
//     }

//     const validPaymentModes = ["CASH", "UPI", "CARD", "CREDIT"];
//     if (!validPaymentModes.includes(paymentMode.toUpperCase())) {
//       return res.status(400).json({
//         success: false,
//         message: `Valid payment mode select karein: ${validPaymentModes.join(", ")}`,
//       });
//     }

//     // Array to track updated items for low stock checking
//     const itemsToCheckForAlerts = [];

//     const saleResult = await prisma.$transaction(
//       async (tx) => {
//         let calculatedGrandTotal = 0;
//         const processedItems = [];

//         for (const item of items) {
//           const { productBarcode, quantity, isLooseItem } = item;
//           const qtyNum = parseInt(quantity);

//           if (!productBarcode || isNaN(qtyNum) || qtyNum <= 0) {
//             throw new Error("Har item ka 'productBarcode' aur positive 'quantity' zaroori hai!");
//           }

//           let stockItem = null;
//           let itemType = 'PACKAGED';

//           if (!isLooseItem) {
//             stockItem = await tx.shopInventory.findFirst({
//               where: { shopId, barcode: String(productBarcode) }
//             });
//           }

//           if (!stockItem) {
//             const looseItem = await tx.shopLooseItem.findFirst({
//               where: {
//                 shopId,
//                 customBarcode: String(productBarcode)
//               }
//             });

//             if (looseItem) {
//               stockItem = looseItem;
//               itemType = 'LOOSE';
//             }
//           }

//           if (!stockItem) {
//             throw new Error(`Item with code/barcode '${productBarcode}' inventory mein nahi mila!`);
//           }

//           const itemName = stockItem.productName || stockItem.customName || stockItem.name || "Item";
//           const unitPrice = parseFloat(stockItem.sellingPrice || stockItem.price || 0);

//           if (stockItem.quantity < qtyNum) {
//             throw new Error(`Insufficient Stock for '${itemName}'! Available: ${stockItem.quantity}, Requested: ${qtyNum}`);
//           }

//           const itemTotal = unitPrice * qtyNum;
//           calculatedGrandTotal += itemTotal;

//           let updatedStockItem;

//           if (itemType === 'PACKAGED') {
//             updatedStockItem = await tx.shopInventory.update({
//               where: { id: stockItem.id },
//               data: { quantity: { decrement: qtyNum } },
//             });
//           } else {
//             updatedStockItem = await tx.shopLooseItem.update({
//               where: { id: stockItem.id },
//               data: { quantity: { decrement: qtyNum } },
//             });
//           }

//           // 🔔 Track item stock status for post-transaction notifications
//           itemsToCheckForAlerts.push({
//             itemName,
//             itemType,
//             remainingQuantity: updatedStockItem.quantity,
//             reorderLevel: stockItem.reorderLevel ?? (itemType === 'PACKAGED' ? 20 : 5),
//           });

//           processedItems.push({
//             itemName: itemName,
//             quantity: qtyNum,
//             pricePerUnit: unitPrice,
//             productId: itemType === 'PACKAGED' ? stockItem.productId : null,
//             batchId: itemType === 'PACKAGED' ? stockItem.batchId : null,
//             looseItemId: itemType === 'LOOSE' ? stockItem.id : null
//           });
//         }

//         const safeDiscount = isNaN(parseFloat(discount)) ? 0 : parseFloat(discount);
//         const finalAmount = Math.max(0, calculatedGrandTotal - safeDiscount);

//         let customerRecord = null;
//         if (customerPhone && customerName) {
//           customerRecord = await tx.customer.upsert({
//             where: {
//               shop_customer_phone_unique: { shopId, phone: customerPhone },
//             },
//             update: {
//               name: customerName,
//               totalDue: paymentMode.toUpperCase() === "CREDIT" ? { increment: finalAmount } : undefined,
//             },
//             create: {
//               shopId,
//               phone: customerPhone,
//               name: customerName,
//               totalDue: paymentMode.toUpperCase() === "CREDIT" ? finalAmount : 0.00,
//             },
//           });
//         }

//         const saleInvoice = await tx.sale.create({
//           data: {
//             shopId,
//             customerId: customerRecord ? customerRecord.id : null,
//             totalAmount: finalAmount,
//             discount: safeDiscount,
//             paymentMode: paymentMode.toUpperCase(),
//             customerPhone: customerPhone || null,
//             saleItems: {
//               create: processedItems,
//             },
//           },
//           include: {
//             saleItems: true,
//             customer: true,
//             shop: true
//           }
//         });

//         if (paymentMode.toUpperCase() === "CREDIT" && customerRecord) {
//           await tx.creditTransaction.create({
//             data: {
//               shopId,
//               customerId: customerRecord.id,
//               saleId: saleInvoice.id,
//               type: "DEBIT",
//               amount: finalAmount,
//               note: `Bill #${saleInvoice.id} Credit Purchase`,
//             },
//           });
//         }

//         const toNum = (val) => (val !== null && val !== undefined ? Number(val) : 0);

//         return {
//           ...saleInvoice,
//           totalAmount: toNum(saleInvoice.totalAmount),
//           discount: toNum(saleInvoice.discount),
//           saleItems: saleInvoice.saleItems.map(si => {
//             const price = toNum(si.pricePerUnit);
//             return {
//               ...si,
//               pricePerUnit: price,
//               price: price,
//               totalPrice: price * si.quantity
//             };
//           })
//         };
//       },
//       { maxWait: 5000, timeout: 10000 }
//     );






//     // 🔔 STEP 8.5: TRIGGER LOW STOCK / OUT OF STOCK NOTIFICATIONS (Async Non-Blocking)
//     (async () => {
//       try {
//         for (const item of itemsToCheckForAlerts) {
//           if (item.remainingQuantity === 0) {
//             await sendAndSaveNotification({
//               shopId,
//               title: "❌ Out of Stock Alert",
//               body: `Product "${item.itemName}" is completely out of stock!`,
//               type: "OUT_OF_STOCK"
//             });
//           } else if (item.remainingQuantity <= item.reorderLevel) {
//             await sendAndSaveNotification({
//               shopId,
//               title: "⚠️ Low Stock Warning",
//               body: `Product "${item.itemName}" reached reorder level. Only ${item.remainingQuantity} left.`,
//               type: "LOW_STOCK"
//             });
//           }
//         }
//       } catch (notifErr) {
//         console.error("Notification Error (Non-fatal):", notifErr.message);
//       }
//     })();







//     // 🧾 STEP 9: PDF GENERATION & BACKBLAZE B2 UPLOAD LOGIC
//     let pdfUrl = null;
//     try {
//       const pdfBuffer = await generateInvoicePDF(saleResult, saleResult.shop || {});
//       const fileName = `Bills/Invoice_${saleResult.id}_${Date.now()}.pdf`;

//       const uploadParams = {
//         Bucket: process.env.B2_BUCKET_NAME,
//         Key: fileName,
//         Body: pdfBuffer,
//         ContentType: "application/pdf",
//       };

//       await s3Client.send(new PutObjectCommand(uploadParams));

//       const endpointHost = process.env.B2_ENDPOINT.replace("https://", "");
//       pdfUrl = `https://${process.env.B2_BUCKET_NAME}.${endpointHost}/${fileName}`;

//       await prisma.sale.update({
//         where: { id: saleResult.id },
//         data: { receiptUrl: pdfUrl },
//       });
//     } catch (pdfErr) {
//       console.error("PDF Upload Warning (Non-fatal):", pdfErr.message);
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Sale processed and Bill generated successfully!",
//       bill: {
//         ...saleResult,
//         pdfUrl: pdfUrl,
//         receiptUrl: pdfUrl,
//       },
//     });

//   } catch (error) {
//     console.error("Sale Error:", error);
//     return res.status(400).json({
//       success: false,
//       message: error.message || "Failed to process sale",
//     });
//   }
// };

// module.exports = { createSale };








const { prisma } = require("../../config/db");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../../config/b2Config");
const generateInvoicePDF = require("../../utils/pdfGenerator");
const { sendAndSaveNotification } = require("../../services/notificationservices");

const createSale = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const {
      items,
      paymentMode = "CASH",
      discount = 0,
      customerName = null,
      customerPhone = null
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart items array required hai aur empty nahi ho sakta!",
      });
    }

    const validPaymentModes = ["CASH", "UPI", "CARD", "CREDIT"];
    if (!validPaymentModes.includes(paymentMode.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Valid payment mode select karein: ${validPaymentModes.join(", ")}`,
      });
    }

    // Array to track updated items for low stock checking
    const itemsToCheckForAlerts = [];

    const saleResult = await prisma.$transaction(
      async (tx) => {
        let calculatedGrandTotal = 0;
        const processedItems = [];

        for (const item of items) {
          const { productBarcode, quantity, isLooseItem } = item;
          let qtyRemaining = parseInt(quantity);

          if (!productBarcode || isNaN(qtyRemaining) || qtyRemaining <= 0) {
            throw new Error("Har item ka 'productBarcode' aur positive 'quantity' zaroori hai!");
          }

          if (isLooseItem) {
            // ──────────────────────────────────────────────
            // LOOSE ITEM LOGIC
            // ──────────────────────────────────────────────
            const looseItem = await tx.shopLooseItem.findFirst({
              where: { shopId, customBarcode: String(productBarcode) }
            });

            if (!looseItem) {
              throw new Error(`Loose item code/barcode '${productBarcode}' inventory mein nahi mila!`);
            }

            if (looseItem.quantity < qtyRemaining) {
              throw new Error(`Insufficient Stock for '${looseItem.customName}'! Available: ${looseItem.quantity}, Requested: ${qtyRemaining}`);
            }

            const unitPrice = parseFloat(looseItem.sellingPrice || 0);
            calculatedGrandTotal += unitPrice * qtyRemaining;

            const updatedLooseItem = await tx.shopLooseItem.update({
              where: { id: looseItem.id },
              data: { quantity: { decrement: qtyRemaining } },
            });

            itemsToCheckForAlerts.push({
              itemName: looseItem.customName,
              itemType: 'LOOSE',
              remainingQuantity: updatedLooseItem.quantity,
              reorderLevel: looseItem.reorderLevel ?? 5,
            });

            processedItems.push({
              itemName: looseItem.customName,
              quantity: qtyRemaining,
              pricePerUnit: unitPrice,
              productId: null,
              batchId: null,
              looseItemId: looseItem.id
            });

          } else {
            // ──────────────────────────────────────────────
            // PACKAGED ITEM LOGIC (BATCH SPLITTING / FIFO)
            // ──────────────────────────────────────────────
            // 1. Barcode se Product ID dhoondhein
            const masterProduct = await tx.masterProduct.findUnique({
              where: { barcode: String(productBarcode) }
            });

            if (!masterProduct) {
              throw new Error(`Product barcode '${productBarcode}' Master Products mein nahi mila!`);
            }

            // 2. Iss shop aur product ke saare available batches Expiry Date (FIFO) ke acc. fetch karein
            const batches = await tx.shopInventory.findMany({
              where: {
                shopId,
                productId: masterProduct.id,
                quantity: { gt: 0 }
              },
              include: { batch: true },
              orderBy: [
                { batch: { expiryDate: 'asc' } },
                { id: 'asc' }
              ]
            });

            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);

            if (totalAvailable < qtyRemaining) {
              throw new Error(`Insufficient Stock for '${masterProduct.productName}'! Total Available: ${totalAvailable}, Requested: ${qtyRemaining}`);
            }

            // Low Stock notification check ke liye total remaining calculate karna
            const totalRemainingForProduct = totalAvailable - qtyRemaining;
            itemsToCheckForAlerts.push({
              itemName: masterProduct.productName,
              itemType: 'PACKAGED',
              remainingQuantity: totalRemainingForProduct,
              reorderLevel: batches[0]?.reorderLevel ?? 20,
            });

            // 3. Batches se quantity deduct karein (e.g., 10 from Batch A, 5 from Batch B)
            for (const batchInv of batches) {
              if (qtyRemaining <= 0) break;

              const deductQty = Math.min(batchInv.quantity, qtyRemaining);
              const unitPrice = parseFloat(batchInv.sellingPrice || 0);

              calculatedGrandTotal += unitPrice * deductQty;
              qtyRemaining -= deductQty;

              await tx.shopInventory.update({
                where: { id: batchInv.id },
                data: { quantity: { decrement: deductQty } }
              });

              processedItems.push({
                itemName: masterProduct.productName,
                quantity: deductQty,
                pricePerUnit: unitPrice,
                productId: masterProduct.id,
                batchId: batchInv.batchId,
                looseItemId: null
              });
            }
          }
        }

        const safeDiscount = isNaN(parseFloat(discount)) ? 0 : parseFloat(discount);
        const finalAmount = Math.max(0, calculatedGrandTotal - safeDiscount);

        let customerRecord = null;
        if (customerPhone && customerName) {
          customerRecord = await tx.customer.upsert({
            where: {
              shop_customer_phone_unique: { shopId, phone: customerPhone },
            },
            update: {
              name: customerName,
              totalDue: paymentMode.toUpperCase() === "CREDIT" ? { increment: finalAmount } : undefined,
            },
            create: {
              shopId,
              phone: customerPhone,
              name: customerName,
              totalDue: paymentMode.toUpperCase() === "CREDIT" ? finalAmount : 0.00,
            },
          });
        }

        const saleInvoice = await tx.sale.create({
          data: {
            shopId,
            customerId: customerRecord ? customerRecord.id : null,
            totalAmount: finalAmount,
            discount: safeDiscount,
            paymentMode: paymentMode.toUpperCase(),
            customerPhone: customerPhone || null,
            saleItems: {
              create: processedItems,
            },
          },
          include: {
            saleItems: true,
            customer: true,
            shop: true
          }
        });

        if (paymentMode.toUpperCase() === "CREDIT" && customerRecord) {
          await tx.creditTransaction.create({
            data: {
              shopId,
              customerId: customerRecord.id,
              saleId: saleInvoice.id,
              type: "DEBIT",
              amount: finalAmount,
              note: `Bill #${saleInvoice.id} Credit Purchase`,
            },
          });
        }

        const toNum = (val) => (val !== null && val !== undefined ? Number(val) : 0);

        return {
          ...saleInvoice,
          totalAmount: toNum(saleInvoice.totalAmount),
          discount: toNum(saleInvoice.discount),
          saleItems: saleInvoice.saleItems.map(si => {
            const price = toNum(si.pricePerUnit);
            return {
              ...si,
              pricePerUnit: price,
              price: price,
              totalPrice: price * si.quantity
            };
          })
        };
      },
      { maxWait: 5000, timeout: 15000 }
    );

    // 🔔 TRIGGER LOW STOCK / OUT OF STOCK NOTIFICATIONS (Async Non-Blocking)
    (async () => {
      try {
        for (const item of itemsToCheckForAlerts) {
          if (item.remainingQuantity === 0) {
            await sendAndSaveNotification({
              shopId,
              title: "❌ Out of Stock Alert",
              body: `Product "${item.itemName}" is completely out of stock!`,
              type: "OUT_OF_STOCK"
            });
          } else if (item.remainingQuantity <= item.reorderLevel) {
            await sendAndSaveNotification({
              shopId,
              title: "⚠️ Low Stock Warning",
              body: `Product "${item.itemName}" reached reorder level. Only ${item.remainingQuantity} left.`,
              type: "LOW_STOCK"
            });
          }
        }
      } catch (notifErr) {
        console.error("Notification Error (Non-fatal):", notifErr.message);
      }
    })();

    // 🧾 PDF GENERATION & BACKBLAZE B2 UPLOAD LOGIC
    let pdfUrl = null;
    try {
      const pdfBuffer = await generateInvoicePDF(saleResult, saleResult.shop || {});
      const fileName = `Bills/Invoice_${saleResult.id}_${Date.now()}.pdf`;

      const uploadParams = {
        Bucket: process.env.B2_BUCKET_NAME,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const endpointHost = process.env.B2_ENDPOINT.replace("https://", "");
      pdfUrl = `https://${process.env.B2_BUCKET_NAME}.${endpointHost}/${fileName}`;

      await prisma.sale.update({
        where: { id: saleResult.id },
        data: { receiptUrl: pdfUrl },
      });
    } catch (pdfErr) {
      console.error("PDF Upload Warning (Non-fatal):", pdfErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Sale processed and Bill generated successfully!",
      bill: {
        ...saleResult,
        pdfUrl: pdfUrl,
        receiptUrl: pdfUrl,
      },
    });

  } catch (error) {
    console.error("Sale Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to process sale",
    });
  }
};

module.exports = { createSale };