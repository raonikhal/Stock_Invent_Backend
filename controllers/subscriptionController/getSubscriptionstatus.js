const { prisma } = require("../../config/db");

const getSubscriptionStatus = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    // 1. Fetch current user state
    const user = await prisma.user.findUnique({
      where: { phone: String(phone) },
      select: {
        id: true,
        isSubscriptionActive: true,
        subscriptionEndAt: true,
        razorpayPaymentId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User record not found" });
    }

    const currentDate = new Date();
    const expiryDate = user.subscriptionEndAt ? new Date(user.subscriptionEndAt) : null;

    // 2. Dynamic Expiry Verification Logic
    let isActive = false;

    if (expiryDate && expiryDate > currentDate) {
      // Trial/Subscription Time Abhi Baaki Hai
      isActive = true;
    } else {
      // ⏱️ TIME EXPIRED! Agar DB mein abhi bhi 1 (true) hai, toh auto 0 (false) set karein
      if (user.isSubscriptionActive) {
        console.log(`🔒 Subscription Expired for ${phone}. Updating DB status to 0...`);
        await prisma.user.update({
          where: { phone: String(phone) },
          data: { isSubscriptionActive: false }, // DB Update: 1 -> 0
        });
      }
      isActive = false;
    }

    // 3. Status Response
    return res.json({
      success: true,
      data: {
        isSubscriptionActive: isActive, // Return true (1) or false (0)
        subscriptionEndAt: user.subscriptionEndAt,
        razorpayPaymentId: user.razorpayPaymentId,
      },
    });
  } catch (error) {
    console.error("Subscription Status Fetch Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSubscriptionStatus };