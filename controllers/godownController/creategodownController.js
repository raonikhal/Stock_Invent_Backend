const { prisma } = require("../../config/db");

/**
 * @desc    Create a new Godown for the logged-in Shopkeeper
 * @route   POST /api/godown/create
 * @access  Private (ShopKeeper)
 */
const createGodown = async (req, res) => {
  try {
    const shopId = req.user.shopId; // Extracted from JWT
    const { godownName, address } = req.body;

    // Validation
    if (!godownName || godownName.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Godown ka naam (godownName) hona zaroori hai!",
      });
    }

    // Check if same shop already has a godown with the same name
    const existingGodown = await prisma.godown.findFirst({
      where: {
        shopId: shopId,
        godownName: godownName.trim(),
      },
    });

    if (existingGodown) {
      return res.status(400).json({
        success: false,
        message: `Aapki shop par '${godownName}' naam ka godown pehle se bana hua hai!`,
      });
    }

    // Create Godown
    const newGodown = await prisma.godown.create({
      data: {
        shopId: shopId,
        godownName: godownName.trim(),
        address: address ? address.trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Godown successfully create ho gaya!",
      data: newGodown,
    });
  } catch (error) {
    console.error("Create Godown Error:", error);
    return res.status(500).json({
      success: false,
      message: "Godown create karne mein server error aaya!",
      error: error.message,
    });
  }
};

/**
 * @desc    Get all Godowns owned by the logged-in Shopkeeper
 * @route   GET /api/godown/list
 * @access  Private (ShopKeeper)
 */
const getShopGodowns = async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const godowns = await prisma.godown.findMany({
      where: { shopId: shopId },
      include: {
        _count: {
          select: { godownInventory: true }, // Total stock entries count
        },
      },
      orderBy: { id: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: godowns.length,
      data: godowns,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Godowns fetch karne mein error aaya!",
      error: error.message,
    });
  }
};

module.exports = { createGodown, getShopGodowns };