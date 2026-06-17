// =============================================
// wishlistController.js
// =============================================
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const { AppError } = require("../middleware/errorMiddleware");

const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "wishlist",
    select: "name price discountPrice images ratings numReviews stock isActive",
  });
  res.status(200).json({ success: true, data: user.wishlist.filter((p) => p.isActive) });
});

const toggleWishlist = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product) return next(new AppError("Product not found.", 404));

  const user = await User.findById(req.user._id);
  const isWishlisted = user.wishlist.includes(productId);

  if (isWishlisted) {
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
  } else {
    user.wishlist.push(productId);
  }
  await user.save();

  res.status(200).json({
    success: true,
    message: isWishlisted ? "Removed from wishlist." : "Added to wishlist!",
    isWishlisted: !isWishlisted,
  });
});

const moveWishlistToCart = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  const product = await Product.findById(productId);
  if (!product || !product.isActive) return next(new AppError("Product not found.", 404));
  if (product.stock < 1) return next(new AppError("Product out of stock.", 400));

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const exists = cart.items.find((i) => i.product.toString() === productId);
  if (!exists) cart.items.push({ product: productId, quantity: 1 });
  await cart.save();

  const user = await User.findById(req.user._id);
  user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
  await user.save();

  res.status(200).json({ success: true, message: "Moved to cart!" });
});

module.exports = { getWishlist, toggleWishlist, moveWishlistToCart };