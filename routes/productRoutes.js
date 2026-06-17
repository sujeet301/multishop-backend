const express = require("express");
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, deleteProductImage, toggleFlashSale } = require("../controllers/productController");
const { protect, authorize, attachSeller } = require("../middleware/authMiddleware");
const { uploadProduct } = require("../config/cloudinary");

router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", protect, authorize("seller"), attachSeller, uploadProduct.array("images", 6), createProduct);
router.put("/:id", protect, authorize("seller", "admin"), attachSeller, uploadProduct.array("images", 6), updateProduct);
router.delete("/:id", protect, authorize("seller", "admin"), attachSeller, deleteProduct);
router.delete("/:id/images/:publicId", protect, authorize("seller"), attachSeller, deleteProductImage);
router.put("/:id/flash-sale", protect, authorize("seller"), attachSeller, toggleFlashSale);

module.exports = router;