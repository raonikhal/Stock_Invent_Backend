const express = require("express");
const router  = express.Router();
const { getDashboardSummary } = require("../controllers/dashboardController");
const { protect } = require("../middlewares/authMiddleware");
const { getDeadStockItems } = require("../controllers/shopProductController/getdeadstockproducts");
const { getExpiringItems } = require("../controllers/shopProductController/getexpiryproducts");

router.get("/summary", protect ,getDashboardSummary);

router.get("/expiry-products", protect,  getExpiringItems);

router.get("/dead-stock", protect, getDeadStockItems);

module.exports = router;