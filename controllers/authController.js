const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Seller = require("../models/Seller");
const { AppError } = require("../middleware/errorMiddleware");
const { sendEmail } = require("../utils/sendEmail");
const { sendTokenResponse } = require("../utils/tokenHelper");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── HELPERS ──────────────────────────────────────────────────

// Check if user can request a new OTP (rate limit: 1 per 60 seconds)
const canResendOTP = (user) => {
  if (!user.otpLastSent) return true;
  const secondsSince = (Date.now() - new Date(user.otpLastSent).getTime()) / 1000;
  return secondsSince >= 60;
};

// ─── REGISTER — Step 1: Send OTP ──────────────────────────────
// @route POST /api/auth/register/send-otp
const registerSendOTP = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return next(new AppError("Name, email and password are required.", 400));
  }

  // Check if email already fully registered
  const existing = await User.findOne({ email });
  if (existing && existing.isVerified) {
    return next(new AppError("This email is already registered. Please login.", 400));
  }

  // Rate limit check for resend
  if (existing && !canResendOTP(existing)) {
    const secondsLeft = Math.ceil(60 - (Date.now() - new Date(existing.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Please wait ${secondsLeft} seconds before requesting a new OTP.`, 429));
  }

  // Delete any pending unverified account with same email
  if (existing && !existing.isVerified) {
    await existing.deleteOne();
  }

  // Create temp user (unverified)
  const user = await User.create({ name, email, password, phone, isVerified: false });

  // Generate & send OTP
  const otp = user.generateOTP("register");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      template: "otpVerification",
      data: { name: user.name, otp, type: "register" },
    });
  } catch (err) {
    await user.deleteOne();
    return next(new AppError("Failed to send OTP email. Please try again.", 500));
  }

  res.status(200).json({
    success: true,
    message: `OTP sent to ${email}. Valid for 10 minutes.`,
    data: { email, otpSentAt: new Date() },
  });
});

// ─── REGISTER — Step 2: Verify OTP & Activate ────────────────
// @route POST /api/auth/register/verify-otp
const registerVerifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError("Email and OTP are required.", 400));
  }

  const user = await User.findOne({ email, isVerified: false }).select("+otp +otpType");

  if (!user) {
    return next(new AppError("No pending registration found. Please register again.", 404));
  }

  // Block after 5 wrong attempts
  if (user.otpAttempts >= 5) {
    await user.deleteOne();
    return next(new AppError("Too many wrong attempts. Please register again.", 429));
  }

  if (!user.otpExpire || user.otpExpire < Date.now()) {
    await user.deleteOne();
    return next(new AppError("OTP has expired. Please register again.", 400));
  }

  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    const remaining = 5 - user.otpAttempts;
    return next(new AppError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400));
  }

  // OTP correct — activate account
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpire = undefined;
  user.otpType = undefined;
  user.otpAttempts = 0;
  user.otpLastSent = undefined;
  await user.save();

  // Welcome email (non-blocking)
  sendEmail({
    email: user.email,
    template: "emailVerification",
    data: { name: user.name, verifyUrl: `${process.env.CLIENT_URL}/products` },
  }).catch(() => {});

  sendTokenResponse(user, 201, res, "Registration successful! Welcome to MultiShop 🎉");
});

// ─── REGISTER — Resend OTP ────────────────────────────────────
// @route POST /api/auth/register/resend-otp
const registerResendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isVerified: false }).select("+otp +otpType");

  if (!user) {
    return next(new AppError("No pending registration found. Please register again.", 404));
  }

  if (!canResendOTP(user)) {
    const secondsLeft = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${secondsLeft}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("register");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      template: "otpVerification",
      data: { name: user.name, otp, type: "register" },
    });
  } catch {
    return next(new AppError("Failed to resend OTP. Try again.", 500));
  }

  res.status(200).json({ success: true, message: `New OTP sent to ${email}.` });
});

// ─── LOGIN ────────────────────────────────────────────────────
// @route POST /api/auth/login
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new AppError("Please provide email and password.", 400));

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError("Invalid email or password.", 401));
  }
  if (!user.isVerified) {
    return next(new AppError("Email not verified. Please complete OTP verification.", 401));
  }
  if (user.isBlocked) {
    return next(new AppError("Your account has been suspended. Contact support.", 403));
  }

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, "Logged in successfully!");
});

// ─── GOOGLE OAUTH ─────────────────────────────────────────────
// @route POST /api/auth/google
const googleLogin = asyncHandler(async (req, res, next) => {
  const { credential } = req.body;
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const { sub: googleId, email, name, picture } = ticket.getPayload();
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    user = await User.create({
      name, email, googleId,
      authProvider: "google",
      isVerified: true,
      avatar: { url: picture },
    });
  } else if (!user.googleId) {
    user.googleId = googleId;
    user.authProvider = "google";
    user.isVerified = true;
    await user.save({ validateBeforeSave: false });
  }

  if (user.isBlocked) return next(new AppError("Your account has been suspended.", 403));

  sendTokenResponse(user, 200, res, "Logged in with Google!");
});

// ─── LOGOUT ───────────────────────────────────────────────────
// @route POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ success: true, message: "Logged out successfully." });
});

// ─── FORGOT PASSWORD — Step 1: Send OTP ──────────────────────
// @route POST /api/auth/forgot-password/send-otp
const forgotPasswordSendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError("Email is required.", 400));

  const user = await User.findOne({ email }).select("+otp +otpType");
  if (!user) {
    // Don't reveal if email exists — return success anyway
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, an OTP has been sent.",
    });
  }

  if (user.authProvider === "google") {
    return next(new AppError("This account uses Google Sign-In. Password reset is not available.", 400));
  }

  if (!canResendOTP(user)) {
    const secondsLeft = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${secondsLeft}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("forgot_password");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      template: "otpVerification",
      data: { name: user.name, otp, type: "forgot_password" },
    });
  } catch {
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send OTP. Try again.", 500));
  }

  res.status(200).json({
    success: true,
    message: `OTP sent to ${email}. Valid for 10 minutes.`,
    data: { email, otpSentAt: new Date() },
  });
});

// ─── FORGOT PASSWORD — Step 2: Verify OTP ────────────────────
// @route POST /api/auth/forgot-password/verify-otp
const forgotPasswordVerifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return next(new AppError("Email and OTP are required.", 400));

  const user = await User.findOne({ email }).select("+otp +otpType");
  if (!user || user.otpType !== "forgot_password") {
    return next(new AppError("No password reset request found. Please try again.", 404));
  }

  if (user.otpAttempts >= 5) {
    user.otp = undefined;
    user.otpExpire = undefined;
    user.otpType = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Too many wrong attempts. Please request a new OTP.", 429));
  }

  if (!user.otpExpire || user.otpExpire < Date.now()) {
    return next(new AppError("OTP has expired. Please request a new one.", 400));
  }

  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    const remaining = 5 - user.otpAttempts;
    return next(new AppError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400));
  }

  // OTP verified — issue a short-lived reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 min to set new password
  user.otp = undefined;
  user.otpExpire = undefined;
  user.otpType = undefined;
  user.otpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "OTP verified successfully! You can now reset your password.",
    data: { resetToken }, // frontend uses this to call reset-password
  });
});

// ─── FORGOT PASSWORD — Step 3: Set New Password ───────────────
// @route PUT /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res, next) => {
  const { resetToken, password } = req.body;
  if (!resetToken || !password) {
    return next(new AppError("Reset token and new password are required.", 400));
  }

  const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) return next(new AppError("Reset token is invalid or has expired.", 400));

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, "Password reset successful! You are now logged in.");
});

// ─── RESEND FORGOT PASSWORD OTP ───────────────────────────────
// @route POST /api/auth/forgot-password/resend-otp
const forgotPasswordResendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select("+otp +otpType");

  if (!user) return next(new AppError("No account found with that email.", 404));

  if (!canResendOTP(user)) {
    const secondsLeft = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${secondsLeft}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("forgot_password");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      email: user.email,
      template: "otpVerification",
      data: { name: user.name, otp, type: "forgot_password" },
    });
  } catch {
    return next(new AppError("Failed to resend OTP.", 500));
  }

  res.status(200).json({ success: true, message: `New OTP sent to ${email}.` });
});

// ─── GET ME ───────────────────────────────────────────────────
// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, data: user });
});

module.exports = {
  // Register OTP flow
  registerSendOTP,
  registerVerifyOTP,
  registerResendOTP,
  // Auth
  login,
  googleLogin,
  logout,
  getMe,
  // Forgot password OTP flow
  forgotPasswordSendOTP,
  forgotPasswordVerifyOTP,
  forgotPasswordResendOTP,
  resetPassword,
};