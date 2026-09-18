const { prisma } = require("../../config/db");

const getDeadStockItems = async (req, res) => {
    try {
        const shopId = req.user?.shopId;
        const daysThreshold = parseInt(req.query.days) || 90;

        if (!shopId) {
            return res.status(400).json({
                success: false,
                message: "Shop context missing in request",
            });
        }

        // 90 Days boundary target
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysThreshold);
        targetDate.setHours(0, 0, 0, 0);

        // 1. Fetch sold item IDs within last N days to exclude them
        const recentSales = await prisma.saleItem.findMany({
            where: {
                sale: {
                    shopId: shopId,
                    createdAt: { gte: targetDate },
                },
            },
            select: {
                productId: true,
                looseItemId: true,
            },
        });

        // Extract unique sold product IDs
        const soldProductIds = new Set(
            recentSales.map((s) => s.productId).filter(Boolean)
        );
        const soldLooseItemIds = new Set(
            recentSales.map((s) => s.looseItemId).filter(Boolean)
        );

        // 2. Fetch inventory & loose items parallelly (Quantity > 0 only)
        const [shopInventory, looseItems] = await Promise.all([
            prisma.shopInventory.findMany({
                where: {
                    shopId: shopId,
                    quantity: { gt: 0 },
                    productId: { notIn: Array.from(soldProductIds) },
                },
                include: {
                    product: true,
                    batch: true,
                },
                orderBy: { updatedAt: "asc" },
            }),

            prisma.shopLooseItem.findMany({
                where: {
                    shopId: shopId,
                    quantity: { gt: 0 },
                    id: { notIn: Array.from(soldLooseItemIds) },
                },
                orderBy: { updatedAt: "asc" },
            }),
        ]);

        // 3. Formatting Barcoded Master Inventory Items
        const formattedInventory = shopInventory.map((item) => ({
            id: `INV_${item.id}`,
            originalId: item.id,
            type: "INVENTORY",
            name: item.productName || item.product?.name || "Unknown Item",
            barcode: item.barcode || "N/A",
            quantity: item.quantity,
            sellingPrice: parseFloat(item.sellingPrice),
            totalValue: parseFloat(item.sellingPrice) * item.quantity,
            lastUpdated: item.updatedAt,
            location: item.sectionName
                ? `${item.sectionName} - ${item.rackNumber || ""}`
                : "N/A",
        }));

        // 4. Formatting Custom Loose Items
        const formattedLoose = looseItems.map((item) => ({
            id: `LOOSE_${item.id}`,
            originalId: item.id,
            type: "LOOSE",
            name: item.customName || "Unknown Loose Item",
            barcode: item.customBarcode || "N/A",
            quantity: item.quantity,
            sellingPrice: parseFloat(item.sellingPrice),
            totalValue: parseFloat(item.sellingPrice) * item.quantity,
            lastUpdated: item.updatedAt,
            location: item.sectionName
                ? `${item.sectionName} - ${item.rackNumber || ""}`
                : "N/A",
        }));

        const allDeadStock = [...formattedInventory, ...formattedLoose];

        // Total tied-up capital in dead stock
        const totalTiedCapital = allDeadStock.reduce(
            (sum, item) => sum + item.totalValue,
            0
        );

        return res.status(200).json({
            success: true,
            count: allDeadStock.length,
            totalTiedCapital: totalTiedCapital,
            data: allDeadStock,
        });
    } catch (error) {
        console.error("Error fetching dead stock items:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dead stock details",
            error: error.message,
        });
    }
};

module.exports = { getDeadStockItems };