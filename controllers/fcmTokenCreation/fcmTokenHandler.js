const { prisma } = require("../../config/db");

const updateFcmToken = async (req, res) => {
    try {
        console.log("FCM Payload received for user:", req.user);

        const { fcmToken } = req.body;
        let userId = req.user?.userId || req.user?.id;

        const shopId = req.user?.shopId;

        if (!fcmToken) {
            return res.status(400).json({ success: false, message: "FCM Token required hai!" });
        }

        // Fallback: Agar token purana hai aur userId missing hai, toh Shop ke Owner ka ID dhoondhein
        if (!userId && shopId) {
            const ownerUser = await prisma.user.findFirst({
                where: { shopId: parseInt(shopId, 10), role: "OWNER" },
                select: { id: true }
            });
            if (ownerUser) userId = ownerUser.id;
        }

        // Validation guard: undefined pass hone se rokne ke liye
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token mein user context missing hai. Relogin karein."
            });
        }

        // Integer conversion
        const targetUserId = parseInt(userId, 10);

        const updatedUser = await prisma.user.update({
            where: { id: targetUserId },
            data: { fcmToken },
        });

        return res.status(200).json({
            success: true,
            message: "FCM Token successfully update ho gaya!",
            data: updatedUser
        });
    } catch (error) {
        console.error("FCM Token update error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
};

module.exports = { updateFcmToken };