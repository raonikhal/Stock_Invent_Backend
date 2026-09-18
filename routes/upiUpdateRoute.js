const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { updateUpi, getUpi } = require("../controllers/upiUpdateController/upiUpdateController");


// UPI Settings & Transaction Routes
router.put("/update-upi", protect, updateUpi);
router.get("/get-upi", protect, getUpi);


module.exports = router;