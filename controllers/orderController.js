const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Coupon = require("../models/Coupon");
const { AppError } = require("../middleware/errorMiddleware");
const { createNotification } = require("../utils/notificationHelper");

// @desc    Place new order
// @route   POST /api/orders
// @access  Private
const placeOrder = asyncHandler(async (req, res, next) => {
  const { items, shippingAddress, paymentMethod, couponCode } = req.body;

  if (!items || items.length === 0) return next(new AppError("No order items.", 400));

  // Validate items & calculate pricing
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product).populate("seller");
    if (!product || !product.isActive) return next(new AppError(`Product ${item.product} not found.`, 404));
    if (product.stock < item.quantity) return next(new AppError(`Insufficient stock for ${product.name}.`, 400));

    const effectivePrice = product.discountPrice > 0 ? product.discountPrice
      : product.isFlashSale && product.flashSaleEnd > new Date() ? product.flashSalePrice
      : product.price;

    orderItems.push({
      product: product._id,
      seller: product.seller._id,
      name: product.name,
      image: product.images[0]?.url,
      price: product.price,
      discountPrice: effectivePrice,
      quantity: item.quantity,
      variant: item.variant || {},
      statusHistory: [{ status: "pending", timestamp: new Date(), note: "Order placed" }],
    });

    subtotal += effectivePrice * item.quantity;
  }

  // Coupon validation
  let discountAmount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true, endDate: { $gt: new Date() } });
    if (!coupon) return next(new AppError("Invalid or expired coupon.", 400));
    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      return next(new AppError(`Minimum order amount for this coupon is ₹${coupon.minOrderAmount}.`, 400));
    }
    if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
      return next(new AppError("Coupon usage limit reached.", 400));
    }
    if (coupon.usedBy.includes(req.user._id)) {
      return next(new AppError("You have already used this coupon.", 400));
    }

    discountAmount = coupon.discountType === "percentage"
      ? Math.min((subtotal * coupon.discountValue) / 100, coupon.maxDiscount || Infinity)
      : coupon.discountValue;

    appliedCoupon = { code: coupon.code, discount: discountAmount };
    coupon.usedCount += 1;
    coupon.usedBy.push(req.user._id);
    await coupon.save();
  }

  // GST calculation (weighted average)
  const totalGst = orderItems.reduce((acc, item) => {
    const product = { gstRate: 18 }; // simplified; could be fetched
    return acc + (item.discountPrice * item.quantity * product.gstRate) / 100;
  }, 0);

  const shipping = subtotal > 500 ? 0 : 49;
  const total = subtotal - discountAmount + shipping + totalGst;

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    coupon: appliedCoupon,
    pricing: {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping,
      gst: Math.round(totalGst * 100) / 100,
      discount: Math.round(discountAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    },
    paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
  });

  // Deduct stock, increment sold
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.quantity, sold: item.quantity },
    });
  }

  // Clear cart
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], couponApplied: null });

  // Notify user
  await createNotification(req.app.get("io"), {
    recipient: req.user._id,
    type: "order_placed",
    title: "Order Placed! 🎉",
    message: `Your order #${order.orderNumber} has been placed successfully.`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id, orderNumber: order.orderNumber },
  });

  res.status(201).json({ success: true, message: "Order placed successfully!", data: order });
});

// @desc    Get user's orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { user: req.user._id };
  if (status) query.overallStatus = status;

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("items.product", "name images price")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({ success: true, total, totalPages: Math.ceil(total / limit), data: orders });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("items.product", "name images")
    .populate("items.seller", "shopName");

  if (!order) return next(new AppError("Order not found.", 404));

  // Only owner or admin can view
  if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return next(new AppError("Not authorized.", 403));
  }

  res.status(200).json({ success: true, data: order });
});

// @desc    Update order item status (seller)
// @route   PUT /api/orders/:orderId/items/:itemId/status
// @access  Private/Seller
const updateOrderItemStatus = asyncHandler(async (req, res, next) => {
  const { status, note, trackingNumber } = req.body;
  const order = await Order.findById(req.params.orderId);
  if (!order) return next(new AppError("Order not found.", 404));

  const item = order.items.id(req.params.itemId);
  if (!item) return next(new AppError("Order item not found.", 404));

  if (item.seller.toString() !== req.seller._id.toString()) {
    return next(new AppError("Not authorized to update this item.", 403));
  }

  item.status = status;
  if (trackingNumber) item.trackingNumber = trackingNumber;
  if (status === "delivered") item.deliveredAt = new Date();
  item.statusHistory.push({ status, timestamp: new Date(), note: note || "" });

  // Update overall order status
  const allStatuses = order.items.map((i) => i.status);
  if (allStatuses.every((s) => s === "delivered")) order.overallStatus = "delivered";
  else if (allStatuses.every((s) => s === "cancelled")) order.overallStatus = "cancelled";
  else if (allStatuses.some((s) => s === "shipped")) order.overallStatus = "shipped";
  else if (allStatuses.some((s) => s === "processing")) order.overallStatus = "processing";

  await order.save();

  // Notify buyer
  const statusMessages = {
    processing: "Your order is being processed.",
    shipped: `Your order has been shipped! Tracking: ${trackingNumber || "N/A"}`,
    out_for_delivery: "Your order is out for delivery.",
    delivered: "Your order has been delivered. Enjoy! 🎉",
    cancelled: "Your order has been cancelled.",
  };

  await createNotification(req.app.get("io"), {
    recipient: order.user,
    type: `order_${status.includes("delivered") ? "delivered" : "shipped"}`,
    title: `Order Update — #${order.orderNumber}`,
    message: statusMessages[status] || `Order status updated to ${status}.`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id },
  });

  res.status(200).json({ success: true, message: "Order status updated!", data: order });
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError("Order not found.", 404));
  if (order.user.toString() !== req.user._id.toString()) return next(new AppError("Not authorized.", 403));
  if (["shipped", "delivered"].includes(order.overallStatus)) {
    return next(new AppError("Cannot cancel order that has been shipped or delivered.", 400));
  }

  order.overallStatus = "cancelled";
  order.items.forEach((item) => {
    if (!["shipped", "delivered"].includes(item.status)) {
      item.status = "cancelled";
      item.statusHistory.push({ status: "cancelled", timestamp: new Date(), note: req.body.reason || "Cancelled by customer" });
    }
  });

  // Restore stock
  for (const item of order.items) {
    if (item.status === "cancelled") {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity, sold: -item.quantity } });
    }
  }

  await order.save();
  res.status(200).json({ success: true, message: "Order cancelled.", data: order });
});

// @desc    Get seller orders
// @route   GET /api/orders/seller-orders
// @access  Private/Seller
const getSellerOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const matchQuery = { "items.seller": req.seller._id };
  if (status) matchQuery["items.status"] = status;

  const total = await Order.countDocuments(matchQuery);
  const orders = await Order.find(matchQuery)
    .populate("user", "name email phone")
    .populate("items.product", "name images price")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({ success: true, total, totalPages: Math.ceil(total / limit), data: orders });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { overallStatus: status } : {};

  const total = await Order.countDocuments(query);
  const orders = await Order.find(query)
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({ success: true, total, totalPages: Math.ceil(total / limit), data: orders });
});

module.exports = { placeOrder, getMyOrders, getOrder, updateOrderItemStatus, cancelOrder, getSellerOrders, getAllOrders };