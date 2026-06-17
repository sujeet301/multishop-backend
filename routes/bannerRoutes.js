const express = require("express");
const router = express.Router();
const { getBanners, createBanner, updateBanner, deleteBanner } = require("../controllers/miscControllers");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadBanner } = require("../config/cloudinary");

router.get("/", getBanners);
router.use(protect, authorize("admin"));
router.post("/", uploadBanner.single("image"), createBanner);
router.put("/:id", updateBanner);
router.delete("/:id", deleteBanner);

module.exports = router;