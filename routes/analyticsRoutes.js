const express = require("express");
const router = express.Router();
const { getSellerAnalytics } = require("../controllers/miscControllers");
const { protect, authorize, attachSeller } = require("../middleware/authMiddleware");

router.get("/seller", protect, authorize("seller"), attachSeller, getSellerAnalytics);

module.exports = router;