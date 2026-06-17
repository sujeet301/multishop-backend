const express = require("express");
const router = express.Router();
const { getCoupons, createCoupon, validateCoupon, deleteCoupon } = require("../controllers/miscControllers");
const { protect, authorize } = require("../middleware/authMiddleware");

router.use(protect);
router.post("/validate", validateCoupon);
router.get("/", authorize("admin", "seller"), getCoupons);
router.post("/", authorize("admin", "seller"), createCoupon);
router.delete("/:id", authorize("admin", "seller"), deleteCoupon);

module.exports = router;