const express = require("express");
const router = express.Router();
const { placeOrder, getMyOrders, getOrder, updateOrderItemStatus, cancelOrder, getSellerOrders, getAllOrders } = require("../controllers/orderController");
const { protect, authorize, attachSeller } = require("../middleware/authMiddleware");

router.use(protect);
router.post("/", placeOrder);
router.get("/my-orders", getMyOrders);
router.get("/seller-orders", authorize("seller"), attachSeller, getSellerOrders);
router.get("/admin/all", authorize("admin"), getAllOrders);
router.get("/:id", getOrder);
router.put("/:id/cancel", cancelOrder);
router.put("/:orderId/items/:itemId/status", authorize("seller"), attachSeller, updateOrderItemStatus);

module.exports = router;