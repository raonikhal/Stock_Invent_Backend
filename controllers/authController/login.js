const { prisma } = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const loginShop = async (req, res) => {
  try {
    const { identifier, password } = req.body; // Phone number YA shopCode

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

    // 3. Generate JWT Token (FIXED: Added role directly or conditionally)
    // Shop owner login through shop table gets default 'OWNER' role
    const token = jwt.sign(
      { 
        shopId: shop.id, 
        shopCode: shop.shopCode, 
        phone: shop.phone, 
        shopName : shop.shopName, 
        role: "OWNER" // FIXED: Pehle 'user.role' ki wajah se crash ho raha tha
      },
      process.env.JWT_SECRET || 'secret_key_123',
      { expiresIn: '365d' }
    );

    const { password: _, ...shopData } = shop;

    res.status(200).json({
      success: true,
      message: "Login Successful!",
      token,
      data: { ...shopData, role: "OWNER" }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { loginShop };
