const express = require("express");
const router = express.Router();
const { registerSeller, getSellerProfile, updateSellerProfile, getSellerDashboard, getPublicSellerProfile } = require("../controllers/sellerController");
const { protect, authorize, attachSeller } = require("../middleware/authMiddleware");

router.get("/:id/public", getPublicSellerProfile);
router.use(protect);
router.post("/register", registerSeller);
router.get("/profile", getSellerProfile);
router.put("/profile", authorize("seller", "admin"), attachSeller, updateSellerProfile);
router.get("/dashboard", authorize("seller"), attachSeller, getSellerDashboard);

module.exports = router;