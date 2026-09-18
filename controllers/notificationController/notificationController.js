const { prisma } = require("../../config/db");

const getNotification = async (req, res) => {
  console.log("GET NOTIFICATION Params:", req.params);
  const { shopId } = req.params;

  // shopId string null check aur Integer parse
  const parsedShopId = parseInt(shopId, 10);

  if (!shopId || isNaN(parsedShopId)) {
    return res.status(400).json({ error: "Invalid or missing shopId parameter." });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { shopId: parsedShopId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (error) {
    console.error("Prisma error:", error);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
};




const markAsRead = async (req, res) => {
  console.log("MARK AS READ Params:", req.params);
  const { id } = req.params;

  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId)) {
    return res.status(400).json({ error: "Invalid notification ID." });
  }

  try {
    const updated = await prisma.notification.update({
      where: { id: parsedId },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (error) {
    console.error("Prisma update error:", error);
    res.status(500).json({ error: "Failed to update notification status." });
  }
};



//notification count for bell icon to add red dot
const getUnreadNotificationCount = async (req, res) => {
  try {
    const shopId = req.user?.shopId;
    const userId = req.user?.userId || req.user?.id;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "Shop ID missing" });
    }

    // Unread notifications count karein (isRead: false)
    const unreadCount = await prisma.notification.count({
      where: {
        shopId: parseInt(shopId, 10),
        OR: [
          { userId: userId ? parseInt(userId, 10) : undefined },
          { userId: null } // General shop-level notifications
        ],
        isRead: false
      }
    });

    return res.status(200).json({
      success: true,
      unreadCount // e.g. 3, 5, ya 0
    });
  } catch (error) {
    console.error("Unread count error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


module.exports = { getNotification, markAsRead , getUnreadNotificationCount};