const express = require("express");
const router = express.Router();
const { getCart, addToCart, updateCartItem, removeFromCart, saveForLater, clearCart } = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);
router.get("/", getCart);
router.post("/", addToCart);
router.put("/:itemId", updateCartItem);
router.delete("/clear", clearCart);
router.delete("/:itemId", removeFromCart);
router.put("/:itemId/save-later", saveForLater);

module.exports = router;