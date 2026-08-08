const express = require("express");
const router = express.Router();
const { getMasterProduct} = require("../controllers/productController/getmasterproduct");
const { createMasterProduct} = require("../controllers/productController/createMasterProduct");
const upload = require("../middlewares/upload");


router.get("/getMasterProduct/:barcode", getMasterProduct);
router.post("/createMasterProduct", upload.single("image") ,createMasterProduct);

module.exports = router;