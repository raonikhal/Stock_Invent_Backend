const { prisma } = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const loginShop = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Mobile Number/ShopCode aur Password zaroori hai!" });
    }

    // 1. Search shop by Phone OR Shop Code
    const shop = await prisma.shop.findFirst({
      where: {
        OR: [
          { phone: identifier },
          { shopCode: identifier.toUpperCase() }
        ]
      }
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop account nahi mila!" });
    }

    // 2. Compare Password Hash
    const isPasswordValid = await bcrypt.compare(password, shop.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Galat password! Dubara koshish karein." });
    }

    // 3. Fetch associated Owner User record (FIX: user ko define kiya)
    let user = await prisma.user.findFirst({
      where: {
        shopId: shop.id,
        role: "OWNER"
      }
    });

    // Agar user record Na mila ho toh auto-create ya fallback handle karein
    if (!user) {
      user = await prisma.user.findFirst({
        where: { shopId: shop.id }
      });
    }

    // 4. Generate JWT Token safely
    const token = jwt.sign(
      {
        shopId: shop.id,
        shopCode: shop.shopCode,
        phone: shop.phone,
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        role: user?.role || "OWNER",
        upiId: shop.upiId  || null,

        userId: user?.id || null,       // Safe Optional chaining
        fcmToken: user?.fcmToken || null // Correct spelling: fcmToken
      },
      process.env.JWT_SECRET || 'secret_key_123',
      { expiresIn: '365d' }
    );

    const { password: _, ...shopData } = shop;

    console.log("Login Successful ⚡");

    return res.status(200).json({
      success: true,
      message: "Login Successful!",
      token,
      data: { ...shopData, role: user?.role || "OWNER", userId: user?.id }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { loginShop };