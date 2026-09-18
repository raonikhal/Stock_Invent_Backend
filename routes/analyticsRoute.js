const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const { getSalesSummary } = require("../controllers/salesAnalyticsController/salesAnalyticsController");


router.get("/salessummary", protect, authorizeRoles("OWNER"), getSalesSummary);


module.exports = router;