const { prisma } = require("../config/db");

const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User context missing in token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSubscriptionActive: true, subscriptionEndAt: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const now = new Date();
    const isExpired = !user.isSubscriptionActive || 
                      (user.subscriptionEndAt && new Date(user.subscriptionEndAt) < now);

    if (isExpired) {
      return res.status(402).json({
        success: false,
        errorCode: 'SUBSCRIPTION_EXPIRED',
        message: 'Aapka subscription khatam ho chuka hai.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server validation error" });
  }
};

module.exports = { checkSubscription };