
const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { getNotification, markAsRead } = require("../controllers/notificationController/notificationController");
const router = express.Router();






// 1. Fetch User Notifications
router.get('/get-notification/:shopId', protect , getNotification);
// 2. Mark Notification as Read
router.patch('/mark-as-read/:id', protect, markAsRead);

module.exports = router;