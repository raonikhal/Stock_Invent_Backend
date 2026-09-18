const { prisma } = require('../../config/db');

// Helper function to safely parse Decimal/Float to Number
const parsePrice = (value) => (value !== null && value !== undefined ? Number(value) : 0);

// 1. Barcode Scan (Shop Specific)
const scannedItem = async (req, res) => {
  try {


    const barcode = req.params.barcode || req.query.barcode;
    const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

    if (!shopId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Shop ID missing from token' });
    }

    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }

    // A) Normal Inventory Search
    const inventoryProduct = await prisma.shopInventory.findFirst({
      where: {
        shopId: shopId,
        barcode: barcode,
        quantity: { gt: 0 }
      },
      include: {
        product: true,
        batch: true,
      },
      orderBy: { id: 'asc' },
    });

    if (inventoryProduct) {
      const priceVal = parsePrice(inventoryProduct.sellingPrice || inventoryProduct.product?.mrp);
      const mrpVal = parsePrice(inventoryProduct.batch?.mrp || inventoryProduct.product?.mrp || priceVal);

      const responseData = {
        id: inventoryProduct.id,
        barcode: inventoryProduct.barcode || inventoryProduct.product?.barcode || '',
        productName: inventoryProduct.productName || inventoryProduct.product?.productName || '',
        mrp: mrpVal,
        sellingPrice: priceVal,
        price: priceVal, // UI fallback
        quantity: inventoryProduct.quantity,
        netWeight: inventoryProduct.product?.netWeight || '',
        imageUrl: inventoryProduct.product?.imageUrl || '',
        isLoose: false,
      };

      return res.status(200).json({ success: true, data: responseData });
    }

    // B) Loose Items Search (customBarcode)
    const looseProduct = await prisma.shopLooseItem.findFirst({
      where: {
        shopId: shopId,
        customBarcode: barcode,
        quantity: { gt: 0 }
      }
    });

    if (looseProduct) {
      const priceVal = parsePrice(looseProduct.sellingPrice);

      const responseData = {
        id: looseProduct.id,
        barcode: looseProduct.customBarcode,
        productName: looseProduct.customName,
        mrp: priceVal,
        sellingPrice: priceVal,
        price: priceVal, // UI fallback
        quantity: looseProduct.quantity,
        netWeight: looseProduct.netWeight || '',
        imageUrl: looseProduct.imageUrl || '',
        isLoose: true,
      };

      return res.status(200).json({ success: true, data: responseData });
    }

    return res.status(404).json({ success: false, message: 'Product not found in your shop inventory' });

  } catch (error) {
    console.error("Scan Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};






// 2. Fetch All Products (Shop Specific Merge & Filter)

// const getproducts_forSell = async (req, res) => {
//   try {
//     const { query } = req.query;
//     const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

//     if (!shopId) {
//       return res.status(401).json({ success: false, message: 'Unauthorized: Shop ID missing from token' });
//     }

//     // A) Fetch Inventory Items (Quantity > 0)
//     const inventory = await prisma.shopInventory.findMany({
//       where: {
//         shopId: shopId,
//         quantity: { gt: 0 }, // 🟢 Sirf vahi items jinki quantity 0 se badi hai
//         ...(query && {
//           OR: [
//             { productName: { contains: query, mode: 'insensitive' } },
//             { barcode: { contains: query, mode: 'insensitive' } },
//             { product: { productName: { contains: query, mode: 'insensitive' } } }
//           ]
//         })
//       },
//       include: {
//         product: true,
//         batch: true
//       }
//     });

//     // B) Fetch Loose Items (Quantity > 0)
//     const looseItems = await prisma.shopLooseItem.findMany({
//       where: {
//         shopId: shopId,
//         quantity: { gt: 0 }, // 🟢 Sirf vahi loose items jinki quantity 0 se badi hai
//         ...(query && {
//           OR: [
//             { customName: { contains: query, mode: 'insensitive' } },
//             { customBarcode: { contains: query, mode: 'insensitive' } }
//           ]
//         })
//       }
//     });

//     // Formatting Standard Inventory
//     const formattedInventory = inventory.map(item => {
//       const priceVal = parsePrice(item.sellingPrice || item.product?.mrp);
//       const mrpVal = parsePrice(item.batch?.mrp || item.product?.mrp || priceVal);

//       return {
//         id: item.id,
//         barcode: item.barcode || item.product?.barcode || '',
//         productName: item.productName || item.product?.productName || 'Unknown Product',
//         mrp: mrpVal,
//         sellingPrice: priceVal,
//         price: priceVal, // UI fallback
//         quantity: item.quantity,
//         reorderLevel: item.reorderLevel || 5,
//         netWeight: item.product?.netWeight || '',
//         imageUrl: item.product?.imageUrl || '',
//         sectionName: item.sectionName || '',
//         rackNumber: item.rackNumber || '',
//         isLoose: false
//       };
//     });

//     // Formatting Loose Items
//     const formattedLoose = looseItems.map(item => {
//       const priceVal = parsePrice(item.sellingPrice);

//       return {
//         id: item.id,
//         barcode: item.customBarcode,
//         productName: item.customName,
//         mrp: priceVal,
//         sellingPrice: priceVal,
//         price: priceVal, // UI fallback
//         quantity: item.quantity,
//         reorderLevel: item.reorderLevel || 5, // 🟢 Included reorderLevel
//         netWeight: item.netWeight || '',
//         imageUrl: item.imageUrl || '',
//         sectionName: item.sectionName || '',
//         rackNumber: item.rackNumber || '',
//         isLoose: true
//       };
//     });

//     const allProducts = [...formattedInventory, ...formattedLoose];

//     return res.status(200).json({
//       success: true,
//       count: allProducts.length,
//       data: allProducts,
//     });

//   } catch (error) {
//     console.error("GetProducts_forSell Error:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };





const getproducts_forSell = async (req, res) => {
  try {
    const { query } = req.query;
    const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

    if (!shopId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Shop ID missing from token' });
    }

    // A) Fetch Inventory Items (Quantity > 0)
    const inventory = await prisma.shopInventory.findMany({
      where: {
        shopId: shopId,
        quantity: { gt: 0 },
        ...(query && {
          OR: [
            { productName: { contains: query, mode: 'insensitive' } },
            { barcode: { contains: query, mode: 'insensitive' } },
            { product: { productName: { contains: query, mode: 'insensitive' } } }
          ]
        })
      },
      include: {
        product: true,
        batch: true
      }
    });

    // B) Fetch Loose Items (Quantity > 0)
    const looseItems = await prisma.shopLooseItem.findMany({
      where: {
        shopId: shopId,
        quantity: { gt: 0 },
        ...(query && {
          OR: [
            { customName: { contains: query, mode: 'insensitive' } },
            { customBarcode: { contains: query, mode: 'insensitive' } }
          ]
        })
      }
    });

    // ─────────────────────────────────────────────────────────────
    // CONSOLIDATE BATCHES (Group by Product / Barcode)
    // ─────────────────────────────────────────────────────────────
    const consolidatedMap = new Map();

    inventory.forEach(item => {
      // Grouping Key: Product ID preference, fallback to barcode
      const key = item.productId ? `PROD_${item.productId}` : `BARCODE_${item.barcode}`;
      const priceVal = parsePrice(item.sellingPrice || item.product?.mrp);
      const mrpVal = parsePrice(item.batch?.mrp || item.product?.mrp || priceVal);

      if (consolidatedMap.has(key)) {
        // Agar product pehle se Map mein hai, to Quantity add karein
        const existing = consolidatedMap.get(key);
        existing.quantity += item.quantity;
      } else {
        // Naya Product Object banayein
        consolidatedMap.set(key, {
          id: item.id, // Primary Inventory ID
          productId: item.productId,
          barcode: item.barcode || item.product?.barcode || '',
          productName: item.productName || item.product?.productName || 'Unknown Product',
          mrp: mrpVal,
          sellingPrice: priceVal,
          price: priceVal, // UI fallback
          quantity: item.quantity, // Initial Quantity
          reorderLevel: item.reorderLevel || 5,
          netWeight: item.product?.netWeight || '',
          imageUrl: item.product?.imageUrl || '',
          sectionName: item.sectionName || '',
          rackNumber: item.rackNumber || '',
          isLoose: false
        });
      }
    });

    // Map to Array Conversion
    const formattedInventory = Array.from(consolidatedMap.values());

    // Formatting Loose Items (Unchanged)
    const formattedLoose = looseItems.map(item => {
      const priceVal = parsePrice(item.sellingPrice);

      return {
        id: item.id,
        barcode: item.customBarcode,
        productName: item.customName,
        mrp: priceVal,
        sellingPrice: priceVal,
        price: priceVal, // UI fallback
        quantity: item.quantity,
        reorderLevel: item.reorderLevel || 5,
        netWeight: item.netWeight || '',
        imageUrl: item.imageUrl || '',
        sectionName: item.sectionName || '',
        rackNumber: item.rackNumber || '',
        isLoose: true
      };
    });

    const allProducts = [...formattedInventory, ...formattedLoose];

    return res.status(200).json({
      success: true,
      count: allProducts.length,
      data: allProducts,
    });

  } catch (error) {
    console.error("GetProducts_forSell Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};





// const getAllProducts = async (req, res) => {
//   try {
//     const { query } = req.query;
//     const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

//     if (!shopId) {
//       return res.status(401).json({ success: false, message: 'Unauthorized: Shop ID missing from token' });
//     }

//     // A) Fetch ALL Inventory Items (Quantity filter removed)
//     const inventory = await prisma.shopInventory.findMany({
//       where: {
//         shopId: shopId,
//         ...(query && {
//           OR: [
//             { productName: { contains: query, mode: 'insensitive' } },
//             { barcode: { contains: query, mode: 'insensitive' } },
//             { product: { productName: { contains: query, mode: 'insensitive' } } }
//           ]
//         })
//       },
//       include: {
//         product: true,
//         batch: true
//       },
//     });

//     // B) Fetch ALL Loose Items (Quantity filter removed)
//     const looseItems = await prisma.shopLooseItem.findMany({
//       where: {
//         shopId: shopId,
//         ...(query && {
//           OR: [
//             { customName: { contains: query, mode: 'insensitive' } },
//             { customBarcode: { contains: query, mode: 'insensitive' } }
//           ]
//         })
//       }
//     });

//     // Formatting Standard Inventory
//     const formattedInventory = inventory.map(item => {
//       const priceVal = parsePrice(item.sellingPrice || item.product?.mrp);
//       const mrpVal = parsePrice(item.batch?.mrp || item.product?.mrp || priceVal);

//       return {
//         id: item.id,
//         barcode: item.barcode || item.product?.barcode || '',
//         productName: item.productName || item.product?.productName || 'Unknown Product',
//         mrp: mrpVal,
//         sellingPrice: priceVal,
//         price: priceVal, // UI fallback
//         quantity: item.quantity,
//         netWeight: item.product?.netWeight || '',
//         imageUrl: item.product?.imageUrl || '',
//         sectionName: item.sectionName || '',
//         batchNumber: item.batch?.batchNumber || '',
//         rackNumber: item.rackNumber || '',
//         reorder: item.reorderLevel,
//         isLoose: false
//       };
//     });

//     // Formatting Loose Items
//     const formattedLoose = looseItems.map(item => {
//       const priceVal = parsePrice(item.sellingPrice);

//       return {
//         id: item.id,
//         barcode: item.customBarcode,
//         productName: item.customName,
//         mrp: priceVal,
//         sellingPrice: priceVal,
//         price: priceVal, // UI fallback
//         quantity: item.quantity,
//         netWeight: item.netWeight || '',
//         imageUrl: item.imageUrl || '',
//         sectionName: item.sectionName || '',
//         batchNumber: item.batch?.batchNumber || 'N/A',
//         rackNumber: item.rackNumber || '',
//         reorder: item.reorderLevel,
//         isLoose: true
//       };
//     });

//     const allProducts = [...formattedInventory, ...formattedLoose];

//     return res.status(200).json({
//       success: true,
//       count: allProducts.length,
//       data: allProducts,
//     });

//   } catch (error) {
//     console.error("GetAllProducts Error:", error);
//     return res.status(500).json({ success: false, error: error.message });
//   }
// };



const getAllProducts = async (req, res) => {
  try {
    const { query } = req.query;
    const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

    if (!shopId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Shop ID missing from token' });
    }

    // A) Fetch ALL Inventory Items
    const inventory = await prisma.shopInventory.findMany({
      where: {
        shopId: shopId,
        ...(query && {
          OR: [
            { productName: { contains: query, mode: 'insensitive' } },
            { barcode: { contains: query, mode: 'insensitive' } },
            { product: { productName: { contains: query, mode: 'insensitive' } } }
          ]
        })
      },
      include: {
        product: true,
        batch: true
      },
      orderBy: { id: 'desc' } // Latest batches pehle aayenge
    });

    // B) Fetch ALL Loose Items
    const looseItems = await prisma.shopLooseItem.findMany({
      where: {
        shopId: shopId,
        ...(query && {
          OR: [
            { customName: { contains: query, mode: 'insensitive' } },
            { customBarcode: { contains: query, mode: 'insensitive' } }
          ]
        })
      }
    });

    // ─────────────────────────────────────────────────────────────
    // BATCH CLEANUP & FILTERING LOGIC
    // ─────────────────────────────────────────────────────────────

    // 1. Group items by product
    const productGroups = new Map();

    inventory.forEach((item) => {
      const groupKey = item.productId ? `PROD_${item.productId}` : `BAR_${item.barcode}`;

      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, []);
      }
      productGroups.get(groupKey).push(item);
    });

    const filteredInventory = [];
    const expiredInventoryIdsToDelete = [];

    productGroups.forEach((batchList) => {
      const activeBatches = batchList.filter((b) => b.quantity > 0);

      if (activeBatches.length > 0) {
        // CASE 1: Agar active stock hai, toh sirf active batches show karein
        filteredInventory.push(...activeBatches);

        // Zero stock batches ko DB Cleanup list mein add karein
        const zeroStockBatches = batchList.filter((b) => b.quantity <= 0);
        zeroStockBatches.forEach(b => expiredInventoryIdsToDelete.push(b.id));
      } else {
        // CASE 2: Agar saare batches 0 hain, toh sirf SABSE LATEST (pehla) batch show karein
        const latestEmptyBatch = batchList[0];
        filteredInventory.push(latestEmptyBatch);

        // Baaki sabhi purane empty batches ko DB delete queue mein daalein
        const redundantEmptyBatches = batchList.slice(1);
        redundantEmptyBatches.forEach(b => expiredInventoryIdsToDelete.push(b.id));
      }
    });

    // ─────────────────────────────────────────────────────────────
    // ASYNC DATABASE CLEANUP (Background Process)
    // ─────────────────────────────────────────────────────────────
    if (expiredInventoryIdsToDelete.length > 0) {
      prisma.shopInventory.deleteMany({
        where: {
          id: { in: expiredInventoryIdsToDelete }
        }
      }).catch(err => console.error("Error cleaning up zero-stock inventory:", err));
    }

    // Formatting Standard Inventory
    const formattedInventory = filteredInventory.map(item => {
      const priceVal = parsePrice(item.sellingPrice || item.product?.mrp);
      const mrpVal = parsePrice(item.batch?.mrp || item.product?.mrp || priceVal);

      return {
        id: item.id,
        barcode: item.barcode || item.product?.barcode || '',
        productName: item.productName || item.product?.productName || 'Unknown Product',
        mrp: mrpVal,
        sellingPrice: priceVal,
        price: priceVal,
        quantity: item.quantity,
        netWeight: item.product?.netWeight || '',
        imageUrl: item.product?.imageUrl || '',
        sectionName: item.sectionName || '',
        batchNumber: item.batch?.batchNumber || '',
        rackNumber: item.rackNumber || '',
        reorder: item.reorderLevel,
        isLoose: false
      };
    });

    // Formatting Loose Items
    const formattedLoose = looseItems.map(item => {
      const priceVal = parsePrice(item.sellingPrice);

      return {
        id: item.id,
        barcode: item.customBarcode,
        productName: item.customName,
        mrp: priceVal,
        sellingPrice: priceVal,
        price: priceVal,
        quantity: item.quantity,
        netWeight: item.netWeight || '',
        imageUrl: item.imageUrl || '',
        sectionName: item.sectionName || '',
        batchNumber: item.batch?.batchNumber || 'N/A',
        rackNumber: item.rackNumber || '',
        reorder: item.reorderLevel,
        isLoose: true
      };
    });

    const allProducts = [...formattedInventory, ...formattedLoose];

    return res.status(200).json({
      success: true,
      count: allProducts.length,
      data: allProducts,
    });

  } catch (error) {
    console.error("GetAllProducts Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};



module.exports = { scannedItem, getAllProducts, getproducts_forSell };