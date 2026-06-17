const express = require("express");
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, createStripeIntent, stripeWebhook, getRazorpayKey } = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

router.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);
router.use(protect);
router.get("/razorpay/key", getRazorpayKey);
router.post("/razorpay/create-order", createRazorpayOrder);
router.post("/razorpay/verify", verifyRazorpayPayment);
router.post("/stripe/create-intent", createStripeIntent);

module.exports = router;