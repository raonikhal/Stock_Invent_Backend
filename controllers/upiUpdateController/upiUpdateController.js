const { prisma } = require('../../config/db.js');

// 1. Get Current Linked UPI ID
const getUpi = async (req, res) => {
  try {
    const shopId = req.user?.shopId; // Extracted from JWT Auth Middleware

    if (!shopId) {
      return res.status(401).json({ success: false, message: "Unauthorized access" });
    }

    const shop = await prisma.shop.findUnique({
      where: { id: Number(shopId) },
      select: { upiId: true },
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    return res.status(200).json({
      success: true,
      upiId: shop.upiId || null,
    });
  } catch (error) {
    console.error("Get UPI Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Add / Update UPI ID
const updateUpi = async (req, res) => {
  try {
    const shopId = req.user?.shopId;
    const { upiId } = req.body;

    if (!shopId) {
      return res.status(401).json({ success: false, message: "Unauthorized access" });
    }

    if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: "Valid UPI ID required (must contain '@')" });
    }

    const updatedShop = await prisma.shop.update({
      where: { id: Number(shopId) },
      data: { upiId: upiId.trim() },
      select: { id: true, upiId: true },
    });

    return res.status(200).json({
      success: true,
      message: "UPI ID updated successfully!",
      upiId: updatedShop.upiId,
    });
  } catch (error) {
    console.error("Update UPI Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getUpi, updateUpi };