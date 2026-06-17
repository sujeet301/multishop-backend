const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const Stripe = require("stripe");
const crypto = require("crypto");
const Order = require("../models/Order");
const { AppError } = require("../middleware/errorMiddleware");
const { createNotification } = require("../utils/notificationHelper");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── RAZORPAY ─────────────────────────────────────────────────

// @desc    Create Razorpay order
// @route   POST /api/payments/razorpay/create-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return next(new AppError("Order not found.", 404));
  if (order.user.toString() !== req.user._id.toString()) return next(new AppError("Not authorized.", 403));

  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(order.pricing.total * 100), // in paise
    currency: "INR",
    receipt: order.orderNumber,
    notes: { orderId: order._id.toString(), userId: req.user._id.toString() },
  });

  res.status(200).json({
    success: true,
    data: {
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
    },
  });
});

// @desc    Verify Razorpay payment
// @route   POST /api/payments/razorpay/verify
// @access  Private
const verifyRazorpayPayment = asyncHandler(async (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return next(new AppError("Payment verification failed. Invalid signature.", 400));
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentResult: {
        id: razorpay_payment_id,
        status: "captured",
        update_time: new Date().toISOString(),
      },
      overallStatus: "processing",
    },
    { new: true }
  );

  await createNotification(req.app.get("io"), {
    recipient: req.user._id,
    type: "payment_success",
    title: "Payment Successful! ✅",
    message: `Payment of ₹${order.pricing.total} received for order #${order.orderNumber}.`,
    link: `/orders/${order._id}`,
  });

  res.status(200).json({ success: true, message: "Payment verified!", data: order });
});

// ─── STRIPE ───────────────────────────────────────────────────

// @desc    Create Stripe Payment Intent
// @route   POST /api/payments/stripe/create-intent
// @access  Private
const createStripeIntent = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;
  const order = await Order.findById(orderId);
  if (!order) return next(new AppError("Order not found.", 404));

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.pricing.total * 100), // in paise/cents
    currency: "inr",
    metadata: { orderId: order._id.toString(), orderNumber: order.orderNumber },
    automatic_payment_methods: { enabled: true },
  });

  res.status(200).json({
    success: true,
    data: { clientSecret: paymentIntent.client_secret },
  });
});

// @desc    Stripe webhook
// @route   POST /api/payments/stripe/webhook
// @access  Public (raw body)
const stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { orderId } = intent.metadata;

    const order = await Order.findByIdAndUpdate(orderId, {
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentResult: { id: intent.id, status: "succeeded" },
      overallStatus: "processing",
    });

    if (order) {
      const io = req.app.get("io");
      await createNotification(io, {
        recipient: order.user,
        type: "payment_success",
        title: "Payment Successful! ✅",
        message: `Payment received for order #${order.orderNumber}.`,
        link: `/orders/${orderId}`,
      });
    }
  }

  res.json({ received: true });
});

// @desc    Get Razorpay key (public)
// @route   GET /api/payments/razorpay/key
// @access  Private
const getRazorpayKey = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, key: process.env.RAZORPAY_KEY_ID });
});

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createStripeIntent,
  stripeWebhook,
  getRazorpayKey,
};