// =============================================
// categoryController.js
// =============================================
const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const { AppError } = require("../middleware/errorMiddleware");

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true, parent: null })
    .sort({ order: 1, name: 1 })
    .populate({ path: "children", options: { sort: { order: 1 } } });
  res.status(200).json({ success: true, data: categories });
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, parent, order } = req.body;
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const image = req.file ? { public_id: req.file.filename, url: req.file.path } : {};
  const category = await Category.create({ name, slug, description, icon, parent, order, image });
  res.status(201).json({ success: true, data: category });
});

const updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) return next(new AppError("Category not found.", 404));
  res.status(200).json({ success: true, data: category });
});

const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);
  if (!category) return next(new AppError("Category not found.", 404));
  await category.deleteOne();
  res.status(200).json({ success: true, message: "Category deleted." });
});

// =============================================
// couponController.js
// =============================================
const Coupon = require("../models/Coupon");

const getCoupons = asyncHandler(async (req, res) => {
  const query = req.user.role === "admin" ? {} : { createdBy: req.user._id };
  const coupons = await Coupon.find(query).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: coupons });
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({
    ...req.body,
    createdBy: req.user._id,
    createdByRole: req.user.role,
  });
  res.status(201).json({ success: true, message: "Coupon created!", data: coupon });
});

const validateCoupon = asyncHandler(async (req, res, next) => {
  const { code, cartTotal } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true, endDate: { $gt: new Date() } });

  if (!coupon) return next(new AppError("Invalid or expired coupon.", 400));
  if (coupon.minOrderAmount && cartTotal < coupon.minOrderAmount) {
    return next(new AppError(`Minimum order amount is ₹${coupon.minOrderAmount}.`, 400));
  }
  if (coupon.maxUsage && coupon.usedCount >= coupon.maxUsage) {
    return next(new AppError("Coupon limit reached.", 400));
  }
  if (coupon.usedBy.includes(req.user._id)) {
    return next(new AppError("You've already used this coupon.", 400));
  }

  const discount = coupon.discountType === "percentage"
    ? Math.min((cartTotal * coupon.discountValue) / 100, coupon.maxDiscount || Infinity)
    : coupon.discountValue;

  res.status(200).json({ success: true, data: { coupon, discount: Math.round(discount * 100) / 100 } });
});

const deleteCoupon = asyncHandler(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return next(new AppError("Coupon not found.", 404));
  await coupon.deleteOne();
  res.status(200).json({ success: true, message: "Coupon deleted." });
});

// =============================================
// bannerController.js
// =============================================
const { Banner } = require("../models/Banner");

const getBanners = asyncHandler(async (req, res) => {
  const query = { isActive: true };
  if (req.query.position) query.position = req.query.position;
  const banners = await Banner.find(query).sort({ order: 1 });
  res.status(200).json({ success: true, data: banners });
});

const createBanner = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Banner image required." });
  const banner = await Banner.create({
    ...req.body,
    image: { public_id: req.file.filename, url: req.file.path },
  });
  res.status(201).json({ success: true, data: banner });
});

const updateBanner = asyncHandler(async (req, res, next) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!banner) return next(new AppError("Banner not found.", 404));
  res.status(200).json({ success: true, data: banner });
});

const deleteBanner = asyncHandler(async (req, res, next) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) return next(new AppError("Banner not found.", 404));
  const { cloudinary } = require("../config/cloudinary");
  if (banner.image?.public_id) await cloudinary.uploader.destroy(banner.image.public_id);
  await banner.deleteOne();
  res.status(200).json({ success: true, message: "Banner deleted." });
});

// =============================================
// notificationController.js
// =============================================
const { Notification } = require("../models/Banner");

const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  res.status(200).json({ success: true, data: notifications, unreadCount });
});

const markAsRead = asyncHandler(async (req, res) => {
  if (req.params.id === "all") {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  } else {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  }
  res.status(200).json({ success: true, message: "Notifications marked as read." });
});

// =============================================
// analyticsController.js — Seller analytics
// =============================================
const Order = require("../models/Order");
const Product = require("../models/Product");

const getSellerAnalytics = asyncHandler(async (req, res) => {
  const sellerId = req.seller._id;

  const [bestSelling, revenueByProduct, conversionData] = await Promise.all([
    Product.find({ seller: sellerId, isActive: true })
      .sort({ sold: -1 })
      .limit(10)
      .select("name sold price discountPrice images views ratings"),
    Order.aggregate([
      { $match: { "items.seller": sellerId, paymentStatus: "paid" } },
      { $unwind: "$items" },
      { $match: { "items.seller": sellerId } },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          revenue: { $sum: { $multiply: ["$items.discountPrice", "$items.quantity"] } },
          unitsSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    Product.aggregate([
      { $match: { seller: sellerId } },
      {
        $project: {
          name: 1, views: 1, sold: 1,
          conversionRate: {
            $cond: [{ $gt: ["$views", 0] }, { $multiply: [{ $divide: ["$sold", "$views"] }, 100] }, 0],
          },
        },
      },
      { $sort: { conversionRate: -1 } },
      { $limit: 10 },
    ]),
  ]);

  res.status(200).json({ success: true, data: { bestSelling, revenueByProduct, conversionData } });
});

module.exports = {
  // Category
  getCategories, createCategory, updateCategory, deleteCategory,
  // Coupon
  getCoupons, createCoupon, validateCoupon, deleteCoupon,
  // Banner
  getBanners, createBanner, updateBanner, deleteBanner,
  // Notification
  getNotifications, markAsRead,
  // Analytics
  getSellerAnalytics,
};