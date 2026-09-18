const { prisma } = require('../../config/db.js');
const bcrypt = require('bcrypt');
const { generateSequentialShopCode } = require('../../utils/generateShopCode.js');

const registerShop = async (req, res) => {
  try {
    console.log("Signup Request Received:", req.body);

    const { shopName, ownerName, phone, password, confirmpassword, district, email } = req.body;

    if (!phone || !password || !district || !confirmpassword || !email) {
      return res.status(400).json({ success: false, message: "Phone, Password aur District required hain!" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ success: false, message: "Password aur Confirm Password match nahi karte!" });
    }

    // 1. Check if phone is registered in Shop table
    const existingShop = await prisma.shop.findUnique({ where: { phone: String(phone) } });
    if (existingShop) {
      return res.status(400).json({ success: false, message: "Yeh phone number pehle se shop table me registered hai!" });
    }

    // 2. Fallback Email & User Table Check
    const userEmail = email;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userEmail },
          { phone: String(phone) }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Yeh Phone/Email user table me pehle se registered hai!" });
    }

    // 3. Hash Password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Generate Sequential Shop Code
    const codeData = await generateSequentialShopCode(district);

    // 5. Calculate Trial Expiry (Exact Current Time + 2 Mins via Pure Timestamp)
    const nowMs = Date.now();
    const trialEndTime = new Date(nowMs + 1 * 60 * 1000); // 120,000 ms

    console.log("Calculated Fresh Trial End Time:", trialEndTime.toISOString());

    // 6. Atomic Transaction: Create Shop + Owner User
    const result = await prisma.$transaction(async (tx) => {
      const createdShop = await tx.shop.create({
        data: {
          shopCode: codeData.shopCode,
          rtoCode: codeData.rtoCode,
          shopName: shopName || "My Store",
          ownerName: ownerName || "Shop Owner",
          phone: String(phone),
          password: hashedPassword,
          district: codeData.district,
          state: codeData.state,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          shopId: createdShop.id,
          name: ownerName || shopName || "Shop Owner",
          email: userEmail,
          password: hashedPassword,
          phone: String(phone),
          role: "OWNER",
          isSubscriptionActive: true,
          subscriptionEndAt: trialEndTime, // FIXED: Direct JS Date Object (No .toISOString())
        },
      });

      return { shop: createdShop, user: createdUser };
    });

    const { password: _, ...shopData } = result.shop;
    const { password: __, ...userData } = result.user;

    return res.status(201).json({
      success: true,
      message: 'Signup Successful! Shop aur Owner Account generate ho gaya hai.',
      data: {
        shop: shopData,
        user: userData,
      },
    });
  } catch (error) {
    console.error("Signup Error Details:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { registerShop };