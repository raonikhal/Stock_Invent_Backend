const express = require("express");
const { createOrder, verifyPayment } = require("../controllers/subscriptionController/paymentcontroller");
const { getSubscriptionStatus } = require("../controllers/subscriptionController/getSubscriptionstatus");

const router = express.Router()


router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.get("/getpayment-status/:phone", getSubscriptionStatus);

module.exports = router;