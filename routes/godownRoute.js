const express = require("express");
const router = express.Router({ mergeParams: true });
const { addGodownStock } = require("../controllers/godownController/godownInventoryController");
const { createGodown , getShopGodowns} = require("../controllers/godownController/creategodownController");
const { transferGodownToShop } = require("../controllers/godownController/transfergodowntoshopController");
const { getGodownInventoryDetails } = require("../controllers/godownController/getgodowninventorydetailsController");
const { protect } = require("../middlewares/authMiddleware");


router.post("/add-stock", protect, addGodownStock);
router.post("/create", protect, createGodown);
router.get("/list", protect, getShopGodowns);
router.post("/transfer-to-shop",protect, transferGodownToShop);
router.get("/:godownId/inventory",protect, getGodownInventoryDetails);

module.exports = router;