const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const { updateSecurityPin, checkPinStatus, verifySecurityPin, forgotPin, verifyPinOtp } = require("../controllers/securitypinController/securitypinhandler");

const router = express.Router();


router.post("/security-pin", protect, updateSecurityPin);
router.get("/check-pin", protect, checkPinStatus);

//for verification dialog
router.post("/verify-pin", protect, verifySecurityPin);
router.post("/forgot-pin", protect,  forgotPin);


router.post("/verify-pin-otp", protect,  verifyPinOtp);



module.exports = router;