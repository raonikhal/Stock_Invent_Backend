const express = require("express");
const { getReorderItems } = require("../controllers/reorderitemsController");
const { protect } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get("/getReorderItems", protect ,getReorderItems);

module.exports = router;











