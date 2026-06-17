const express = require("express");
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require("../controllers/miscControllers");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadProduct } = require("../config/cloudinary");

router.get("/", getCategories);
router.post("/", protect, authorize("admin"), uploadProduct.single("image"), createCategory);
router.put("/:id", protect, authorize("admin"), updateCategory);
router.delete("/:id", protect, authorize("admin"), deleteCategory);

module.exports = router;