const express = require("express");
const { sendSupportTicket } = require("../controllers/supportController/supportController");
const router = express.Router()

router.post("submit-ticket", sendSupportTicket);


module.exports = router;