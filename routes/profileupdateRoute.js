const express = require("express");
const { updateShopProfile } = require("../controllers/profilecontroller/profilecontroller");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post('/update-profile', protect , updateShopProfile);

module.exports = router;