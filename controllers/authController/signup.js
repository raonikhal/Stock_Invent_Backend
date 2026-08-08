const { prisma } = require('../../config/db.js');
const bcrypt = require('bcrypt');
const { generateSequentialShopCode } = require('../../utils/generateShopCode.js');

const registerShop = async (req, res) => {
  try {
    const { shopName, ownerName, phone, password, confirmpassword, district } = req.body;

    if (!phone || !password || !district || !confirmpassword) {
      return res.status(400).json({ success: false, message: "Phone, Password aur District required hain!" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ success: false, message: "Password aur Confirm Password match nahi karte!" });
    }

    // 1. Check if phone is already registered
    const existingShop = await prisma.shop.findUnique({ where: { phone } });
    if (existingShop) {
      return res.status(400).json({ success: false, message: "Yeh phone number pehle se registered hai!" });
    }

    // 2. Hash Password (Security Best Practice)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Generate Sequential RTO Code (e.g., UP50-0001)
    const codeData = await generateSequentialShopCode(district);

    // 4. Save Shop to DB
    const newShop = await prisma.shop.create({
      data: {
        shopCode: codeData.shopCode,
        rtoCode: codeData.rtoCode,
        shopName,
        ownerName,
        phone,
        password: hashedPassword,
        district: codeData.district,
        state: codeData.state,
      },
    });

    // Password field ko response se hata dein
    const { password: _, ...shopWithoutPassword } = newShop;

    res.status(201).json({
      success: true,
      message: 'Signup Successful! Aapka Shop Code generate ho gaya hai.',
      data: shopWithoutPassword,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { registerShop };