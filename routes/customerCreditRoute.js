const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();
const {getCreditCustomers, clearCustomerDue, getCustomerLedger} = require("../controllers/customerController/creditController")


router.get("/credit/customers", protect, getCreditCustomers);
router.post("/credit/pay", protect, clearCustomerDue);
router.get("/credit/ledger/:phone", protect, getCustomerLedger);

module.exports = router;