const { prisma } = require("../config/db");

// 🟢 Helper function to safely parse Decimal/String/Number to Float
const parsePrice = (price) => {
  if (price === null || price === undefined) return 0.0;
  const parsed = parseFloat(price);
  return isNaN(parsed) ? 0.0 : parsed;
};

const getReorderItems = async (req, res) => {
  try {
    const { query } = req.query;
    const shopId = req.user?.shopId ? parseInt(req.user.shopId) : null;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Shop ID missing from token'
      });
    }

    // Common search filter logic
    const buildSearchFilter = (nameField, barcodeField) => {
      if (!query) return {};
      return {
        OR: [
          { [nameField]: { contains: query, mode: 'insensitive' } },
          { [barcodeField]: { contains: query, mode: 'insensitive' } },
        ]
      };
    };

    // A) Fetch Inventory Items
    const inventory = await prisma.shopInventory.findMany({
      where: {
        shopId: shopId,
        ...buildSearchFilter('productName', 'barcode')
      },
      include: {
        product: true,
        batch: true
      }
    });

    // B) Fetch Loose Items
    const looseItems = await prisma.shopLooseItem.findMany({
      where: {
        shopId: shopId,
        ...buildSearchFilter('customName', 'customBarcode')
      }
    });

    // 🟢 Filter & Format Standard Inventory (quantity <= reorderLevel)
    const formattedInventory = inventory
      .filter(item => {
        const reorderLevel = item.reorderLevel ?? 20;
        return item.quantity <= reorderLevel;
      })
      .map(item => {
        const priceVal = parsePrice(item.sellingPrice || item.product?.mrp);
        const mrpVal = parsePrice(item.batch?.mrp || item.product?.mrp || priceVal);

        return {
          id: item.id,
          barcode: item.barcode || item.product?.barcode || 'N/A',
          productName: item.productName || item.product?.productName || 'Unknown Product',
          mrp: mrpVal,
          sellingPrice: priceVal,
          price: priceVal,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel ?? 20,
          lastReorderQuantity: (item.reorderLevel ?? 20) > 0 ? (item.reorderLevel ?? 20) : 10,
          netWeight: item.product?.netWeight || '',
          imageUrl: item.product?.imageUrl || '',
          sectionName: item.sectionName || '',
          rackNumber: item.rackNumber || '',
          isLoose: false
        };
      });

    // 🟢 Filter & Format Loose Items (quantity <= reorderLevel)
    const formattedLoose = looseItems
      .filter(item => {
        const reorderLevel = item.reorderLevel ?? 5;
        return item.quantity <= reorderLevel;
      })
      .map(item => {
        const priceVal = parsePrice(item.sellingPrice);

        return {
          id: item.id,
          barcode: item.customBarcode || 'N/A',
          productName: item.customName || 'Unknown Loose Item',
          mrp: priceVal,
          sellingPrice: priceVal,
          price: priceVal,
          quantity: item.quantity,
          reorderLevel: item.reorderLevel ?? 5,
          lastReorderQuantity: (item.reorderLevel ?? 5) > 0 ? (item.reorderLevel ?? 5) : 10,
          netWeight: item.netWeight || '',
          imageUrl: item.imageUrl || '',
          sectionName: item.sectionName || '',
          rackNumber: item.rackNumber || '',
          isLoose: true
        };
      });

    const reorderRequiredProducts = [...formattedInventory, ...formattedLoose];

    return res.status(200).json({
      success: true,
      count: reorderRequiredProducts.length,
      data: reorderRequiredProducts,
    });

  } catch (error) {
    console.error("Reorder_Products Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getReorderItems };