const express = require("express");
const router = express.Router();
const { addProduct} = require("../controllers/shopProductController/addproduct");
const { createSale } = require("../controllers/shopProductController/createsale");
const { getInventoryAlerts } = require("../controllers/inventorycontroller")
const { protect } = require("../middlewares/authMiddleware");

router.post("/addProduct", protect ,addProduct);
router.post("/createSale", protect, createSale);
router.get('/inventoryAlerts', protect, getInventoryAlerts);

module.exports = router;