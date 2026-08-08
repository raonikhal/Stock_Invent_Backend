const express = require('express');
const router = express.Router();
const { registerShop} = require("../controllers/authController/signup");
const { loginShop } = require("../controllers/authController/login");


router.post('/signup', registerShop);
router.post('/login', loginShop);


module.exports = router;