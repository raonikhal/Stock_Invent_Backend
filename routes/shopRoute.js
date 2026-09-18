const express = require("express");
const router = express.Router();
const { addProduct } = require("../controllers/shopProductController/addproduct");
const { getInventoryAlerts } = require("../controllers/inventorycontroller")
const { protect } = require("../middlewares/authMiddleware");
const { scannedItem, getAllProducts, getproducts_forSell } = require("../controllers/shopProductController/productList&scan");
const { addLooseProduct } = require("../controllers/shopProductController/addlooseproduct");
const upload = require("../middlewares/upload");
const { getSalesHistory } = require("../controllers/shopProductController/getsaledetails");
const { uploadSaleBill } = require("../controllers/shopProductController/uploadBills");
const { manualConfirmPayment } = require("../controllers/manualpaystatusController");
const { createSale } = require("../controllers/shopProductController/createSale");




router.post("/addProduct", protect, addProduct);
router.post("/addLooseProduct", protect, upload.single("image"), addLooseProduct);

router.post("/createSale", protect, createSale);
router.get("/scan_sell/:barcode", protect, scannedItem);

router.get("/getproduct_forSell", protect, getproducts_forSell); // This route is for fetching products specifically for selling, with shop-specific merge and filter logic.
router.get("/getproduct_list", protect, getAllProducts);

router.get('/inventoryAlerts', protect, getInventoryAlerts);  // ❌

router.post("/manual-confirm", protect, manualConfirmPayment);


router.get('/getsaleshistory', protect, getSalesHistory);   // ❌
router.post("/uploadBill", protect, upload.single("pdf"), uploadSaleBill);



module.exports = router;