const asyncHandler = require("express-async-handler");
const Seller = require("../models/Seller");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { AppError } = require("../middleware/errorMiddleware");

const registerSeller = asyncHandler(async (req, res, next) => {
  const existing = await Seller.findOne({ user: req.user._id });
  if (existing) return next(new AppError("Seller profile already exists.", 400));

  const seller = await Seller.create({ ...req.body, user: req.user._id });
  res.status(201).json({
    success: true,
    message: "Seller application submitted! We'll review it within 24 hours.",
    data: seller,
  });
});

const getSellerProfile = asyncHandler(async (req, res, next) => {
  const seller = await Seller.findOne({ user: req.user._id }).populate("user", "name email phone");
  if (!seller) return next(new AppError("Seller profile not found.", 404));
  res.status(200).json({ success: true, data: seller });
});

const updateSellerProfile = asyncHandler(async (req, res) => {
  const allowed = ["shopName", "shopDescription", "businessType", "gstNumber", "panNumber", "address"];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (req.files?.logo) {
    updates.shopLogo = { public_id: req.files.logo[0].filename, url: req.files.logo[0].path };
  }
  if (req.files?.banner) {
    updates.shopBanner = { public_id: req.files.banner[0].filename, url: req.files.banner[0].path };
  }

  const seller = await Seller.findOneAndUpdate({ user: req.user._id }, updates, { new: true });
  res.status(200).json({ success: true, message: "Shop profile updated!", data: seller });
});

const getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;

  const [totalProducts, totalOrders, revenueResult, topProducts] = await Promise.all([
    Product.countDocuments({ seller: sellerId, isActive: true }),
    Order.countDocuments({ "items.seller": sellerId }),
    Order.aggregate([
      { $match: { "items.seller": sellerId, paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      { $group: { _id: null, total: { $sum: { $multiply: ["$items.discountPrice", "$items.quantity"] } } } },
    ]),
    Product.find({ seller: sellerId }).sort({ sold: -1 }).limit(5).select("name sold price images ratings"),
  ]);

  // Monthly sales
  const monthlySales = await Order.aggregate([
    { $match: { "items.seller": sellerId, paymentStatus: "paid" } },
    { $unwind: "$items" },
    { $match: { "items.seller": sellerId } },
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
        revenue: { $sum: { $multiply: ["$items.discountPrice", "$items.quantity"] } },
        orders: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    { $limit: 12 },
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue: revenueResult[0]?.total || 0,
        rating: req.seller.rating,
      },
      monthlySales,
      topProducts,
    },
  });
});

const getPublicSellerProfile = asyncHandler(async (req, res, next) => {
  const seller = await Seller.findById(req.params.id)
    .populate("user", "name")
    .select("shopName shopDescription shopLogo shopBanner rating totalRatings totalProducts totalOrders");

  if (!seller || seller.status !== "approved") return next(new AppError("Seller not found.", 404));

  const products = await Product.find({ seller: seller._id, isActive: true })
    .sort({ createdAt: -1 })
    .limit(12)
    .select("name price discountPrice images ratings numReviews");

  res.status(200).json({ success: true, data: { seller, products } });
});

module.exports = { registerSeller, getSellerProfile, updateSellerProfile, getSellerDashboard, getPublicSellerProfile };