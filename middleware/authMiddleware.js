const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Seller = require("../models/Seller");
const { AppError } = require("./errorMiddleware");

// Protect routes — must be logged in
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError("Not authorized. Please log in.", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    return next(new AppError("User no longer exists.", 401));
  }
  if (user.isBlocked) {
    return next(new AppError("Your account has been suspended. Please contact support.", 403));
  }

  req.user = user;
  next();
});

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Role '${req.user.role}' is not authorized to access this route.`, 403));
    }
    next();
  };
};

// Attach seller profile to request
const attachSeller = asyncHandler(async (req, res, next) => {
  const seller = await Seller.findOne({ user: req.user._id });
  if (!seller) {
    return next(new AppError("Seller profile not found.", 404));
  }
  if (seller.status !== "approved") {
    return next(new AppError(`Seller account is ${seller.status}. Please wait for approval.`, 403));
  }
  req.seller = seller;
  next();
});

// Optional auth — doesn't fail if not logged in
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch {
      // silently fail
    }
  }
  next();
});

module.exports = { protect, authorize, attachSeller, optionalAuth };