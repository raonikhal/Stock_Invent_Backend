// services/notificationservices.js

const { prisma } = require("../config/db");
const firebaseAdmin = require("firebase-admin"); // Direct admin instance ya initialize file require karein

async function sendAndSaveNotification({
    shopId,
    userId,
    title,
    body,
    type,
}) {
    // 1. Database mein Notification record save karein
    const notification = await prisma.notification.create({
        data: {
            shopId,
            userId,
            title,
            body,
            type,
        },
    });

    // 2. Target Users ke FCM Tokens fetch karein
    const whereClause = userId ? { id: userId } : { shopId };
    const users = await prisma.user.findMany({
        where: { ...whereClause, fcmToken: { not: null } },
        select: { fcmToken: true },
    });

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    // 3. FCM Push Notification send karein
    if (tokens.length > 0) {
        const message = {
            notification: { title, body },
            data: {
                notificationId: String(notification.id),
                type: String(type),
            },
            tokens: tokens,
        };

        try {
            await firebaseAdmin.messaging().sendEachForMulticast(message);
        } catch (error) {
            console.error('Error sending FCM push notification:', error);
        }
    }

    return notification;
}

// CommonJS Export Syntax
module.exports = {
    sendAndSaveNotification,
};