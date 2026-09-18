const { prisma } = require("../../config/db");

const updateShopProfile = async (req, res) => {
  try {
    // JWT Token middleware se user/shop info request Object me se nikaalein
    const shopId = req.user?.shopId || req.user?.id;
    const { ownerName, shopName } = req.body;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access. Shop ID missing.',
      });
    }

    // Input fields validate karein
    if (!ownerName || !shopName) {
      return res.status(400).json({
        success: false,
        message: 'ownerName aur shopName dono required hain.',
      });
    }

    // Prisma ORM ke zariye Shop record update karein
    const updatedShop = await prisma.shop.update({
      where: {
        id: shopId,
      },
      data: {
        ownerName: ownerName.trim(),
        shopName: shopName.trim(),
      },
      select: {
        id: true,
        ownerName: true,
        shopName: true,
        shopCode: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedShop,
    });
  } catch (error) {
    console.error('Error updating shop profile:', error);

    // Record Not Found error handling (Prisma P2025 code)
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop record nahi mila.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  updateShopProfile,
};