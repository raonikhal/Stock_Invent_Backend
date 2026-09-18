const express = require('express');
const router = express.Router();
const { registerShop } = require("../controllers/authController/signup");
const { loginShop } = require("../controllers/authController/login");
const { protect } = require('../middlewares/authMiddleware');
const { deleteAccount } = require('../controllers/deleteAccountController/deleteaccounthandler');
const { forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController/forgotpassword');


router.post('/signup', registerShop);
router.post('/login', loginShop);


router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

router.delete("/delete-account", protect, deleteAccount);


module.exports = router;