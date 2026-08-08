import {prisma} from '../config/db.js';
import { generateSequentialShopCode } from '../utils/generateShopCode.js';

export const createShop = async (req, res) => {
  try {
    const { shopName, ownerName, phone, district } = req.body;

    if (!district) {
      return res.status(400).json({ success: false, message: "District name required hai!" });
    }

    // Auto-increment sequential shop code generate karein
    const codeData = await generateSequentialShopCode(district);

    const newShop = await prisma.shop.create({
      data: {
        shopCode: codeData.shopCode, // Output: "UP50-0001"
        rtoCode: codeData.rtoCode,   // Output: "UP50"
        shopName,
        ownerName,
        phone,
        district: codeData.district,
        state: codeData.state,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Shop successfully onboarded!',
      data: newShop,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Yeh phone number pehle se kisi dukan se linked hai!',
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};