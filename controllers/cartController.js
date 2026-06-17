const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { AppError } = require("../middleware/errorMiddleware");

const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "items.product",
    select: "name price discountPrice images stock isActive seller isFlashSale flashSalePrice flashSaleEnd",
    populate: { path: "seller", select: "shopName" },
  });

  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  // Filter out inactive products
  cart.items = cart.items.filter((item) => item.product?.isActive);

  // Calculate totals
  let subtotal = 0;
  const processedItems = cart.items.map((item) => {
    const p = item.product;
    const effectivePrice = p.discountPrice > 0 ? p.discountPrice
      : p.isFlashSale && p.flashSaleEnd > new Date() ? p.flashSalePrice : p.price;
    subtotal += effectivePrice * item.quantity;
    return { ...item.toObject(), effectivePrice };
  });

  res.status(200).json({
    success: true,
    data: {
      items: processedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      shipping: subtotal > 500 ? 0 : 49,
      couponApplied: cart.couponApplied,
    },
  });
});

const addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity = 1, variant } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) return next(new AppError("Product not found.", 404));
  if (product.stock < quantity) return next(new AppError("Insufficient stock.", 400));

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const existingItem = cart.items.find(
    (i) => i.product.toString() === productId && JSON.stringify(i.variant) === JSON.stringify(variant)
  );

  if (existingItem) {
    const newQty = existingItem.quantity + quantity;
    if (newQty > product.stock) return next(new AppError("Cannot add more than available stock.", 400));
    existingItem.quantity = newQty;
    existingItem.savedForLater = false;
  } else {
    cart.items.push({ product: productId, quantity, variant, savedForLater: false });
  }

  await cart.save();
  res.status(200).json({ success: true, message: "Added to cart!", count: cart.items.filter(i => !i.savedForLater).length });
});

const updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError("Cart not found.", 404));

  const item = cart.items.id(req.params.itemId);
  if (!item) return next(new AppError("Item not found in cart.", 404));

  if (quantity <= 0) {
    cart.items.pull(req.params.itemId);
  } else {
    item.quantity = quantity;
  }

  await cart.save();
  res.status(200).json({ success: true, message: "Cart updated!" });
});

const removeFromCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError("Cart not found.", 404));
  cart.items.pull(req.params.itemId);
  await cart.save();
  res.status(200).json({ success: true, message: "Item removed from cart." });
});

const saveForLater = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new AppError("Cart not found.", 404));
  const item = cart.items.id(req.params.itemId);
  if (!item) return next(new AppError("Item not found.", 404));
  item.savedForLater = !item.savedForLater;
  await cart.save();
  res.status(200).json({ success: true, message: item.savedForLater ? "Saved for later." : "Moved to cart." });
});

const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [], couponApplied: null });
  res.status(200).json({ success: true, message: "Cart cleared." });
});

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, saveForLater, clearCart };