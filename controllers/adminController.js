const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Seller = require("../models/Seller");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { AppError } = require("../middleware/errorMiddleware");
const { createNotification } = require("../utils/notificationHelper");

// @desc    Admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalSellers, totalProducts, totalOrders,
    revenueResult, recentOrders, topProducts,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    Seller.countDocuments({ status: "approved" }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: null, total: { $sum: "$pricing.total" } } }]),
    Order.find().sort({ createdAt: -1 }).limit(10).populate("user", "name email"),
    Product.find({ isActive: true }).sort({ sold: -1 }).limit(5).select("name sold price images"),
  ]);

  // Monthly revenue (last 12 months)
  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        paymentStatus: "paid",
        createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) },
      },
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
        revenue: { $sum: "$pricing.total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        totalRevenue: revenueResult[0]?.total || 0,
      },
      monthlyRevenue,
      recentOrders,
      topProducts,
    },
  });
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  const query = {};
  if (role) query.role = role;
  if (search) query.$or = [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }];

  const total = await User.countDocuments(query);
  const users = await User.find(query)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({ success: true, total, data: users });
});

// @desc    Block/Unblock user
// @route   PUT /api/admin/users/:id/toggle-block
// @access  Private/Admin
const toggleUserBlock = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError("User not found.", 404));
  if (user.role === "admin") return next(new AppError("Cannot block an admin.", 400));

  user.isBlocked = !user.isBlocked;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully.`,
    data: { isBlocked: user.isBlocked },
  });
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError("User not found.", 404));
  if (user.role === "admin") return next(new AppError("Cannot delete an admin.", 400));
  await user.deleteOne();
  res.status(200).json({ success: true, message: "User deleted." });
});

// @desc    Get pending sellers
// @route   GET /api/admin/sellers
// @access  Private/Admin
const getSellers = asyncHandler(async (req, res) => {
  const { status = "pending", page = 1, limit = 20 } = req.query;
  const total = await Seller.countDocuments({ status });
  const sellers = await Seller.find({ status })
    .populate("user", "name email phone")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  res.status(200).json({ success: true, total, data: sellers });
});

// @desc    Approve / Reject / Suspend seller
// @route   PUT /api/admin/sellers/:id/status
// @access  Private/Admin
const updateSellerStatus = asyncHandler(async (req, res, next) => {
  const { status, reason } = req.body;
  if (!["approved", "rejected", "suspended"].includes(status)) {
    return next(new AppError("Invalid status.", 400));
  }

  const seller = await Seller.findByIdAndUpdate(
    req.params.id,
    { status, rejectionReason: reason || "" },
    { new: true }
  ).populate("user", "_id name email");

  if (!seller) return next(new AppError("Seller not found.", 404));

  // Update user role
  if (status === "approved") {
    await User.findByIdAndUpdate(seller.user._id, { role: "seller" });
  } else if (status === "rejected" || status === "suspended") {
    await User.findByIdAndUpdate(seller.user._id, { role: "user" });
  }

  const notifMessages = {
    approved: "Congratulations! Your seller account has been approved. 🎉",
    rejected: `Your seller application was rejected. Reason: ${reason || "Please contact support."}`,
    suspended: "Your seller account has been suspended. Please contact support.",
  };

  await createNotification(req.app.get("io"), {
    recipient: seller.user._id,
    type: "seller_approved",
    title: `Seller Account ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: notifMessages[status],
    link: "/seller/dashboard",
  });

  res.status(200).json({ success: true, message: `Seller ${status}.`, data: seller });
});

// @desc    Platform revenue overview
// @route   GET /api/admin/revenue
// @access  Private/Admin
const getRevenueOverview = asyncHandler(async (req, res) => {
  const { period = "monthly" } = req.query;

  const groupBy =
    period === "daily"
      ? { day: { $dayOfMonth: "$createdAt" }, month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }
      : period === "weekly"
      ? { week: { $week: "$createdAt" }, year: { $year: "$createdAt" } }
      : { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } };

  const revenue = await Order.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: groupBy,
        grossRevenue: { $sum: "$pricing.total" },
        orders: { $sum: 1 },
        avgOrderValue: { $avg: "$pricing.total" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const platformRevenue = revenue.map((r) => ({
    ...r,
    platformCommission: Math.round(r.grossRevenue * 0.1 * 100) / 100,
  }));

  res.status(200).json({ success: true, data: platformRevenue });
});

module.exports = { getDashboard, getUsers, toggleUserBlock, deleteUser, getSellers, updateSellerStatus, getRevenueOverview };