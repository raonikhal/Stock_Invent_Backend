const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { updateFcmToken } = require("../controllers/fcmTokenCreation/fcmTokenHandler");


router.put('/update-fcm-token', protect, updateFcmToken);


module.exports = router;




