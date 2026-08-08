const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middlewares/authMiddleware");
const { getDailySalesSummary } = require("../controllers/salesAnalyticsController/salesAnalyticsController");


router.get("/dailysummary", protect, authorizeRoles("OWNER"), getDailySalesSummary);


module.exports = router;