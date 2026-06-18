const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { AppError } = require("../middleware/errorMiddleware");
const { sendEmail } = require("../utils/sendEmail");
const { sendTokenResponse } = require("../utils/tokenHelper");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── HELPER ───────────────────────────────────────────────────
const canResendOTP = (user) => {
  if (!user.otpLastSent) return true;
  return (Date.now() - new Date(user.otpLastSent).getTime()) / 1000 >= 60;
};

// ══════════════════════════════════════════════════════════════
//  REGISTER — OTP FLOW
// ══════════════════════════════════════════════════════════════

// @route POST /api/auth/register/send-otp
const registerSendOTP = asyncHandler(async (req, res, next) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password)
    return next(new AppError("Name, email and password are required.", 400));

  const existing = await User.findOne({ email });
  if (existing && existing.isVerified)
    return next(new AppError("Email already registered. Please login.", 400));

  if (existing && !canResendOTP(existing)) {
    const s = Math.ceil(60 - (Date.now() - new Date(existing.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${s}s before requesting a new OTP.`, 429));
  }

  if (existing && !existing.isVerified) await existing.deleteOne();

  const user = await User.create({ name, email, password, phone, isVerified: false });
  const otp = user.generateOTP("register");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({ email, template: "otpVerification", data: { name, otp, type: "register" } });
  } catch {
    await user.deleteOne();
    return next(new AppError("Failed to send OTP email. Try again.", 500));
  }

  res.status(200).json({ success: true, message: `OTP sent to ${email}. Valid for 10 minutes.`, data: { email } });
});

// @route POST /api/auth/register/verify-otp
const registerVerifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return next(new AppError("Email and OTP are required.", 400));

  const user = await User.findOne({ email, isVerified: false }).select("+otp +otpType");
  if (!user) return next(new AppError("No pending registration found. Please register again.", 404));

  if (user.otpAttempts >= 5) {
    await user.deleteOne();
    return next(new AppError("Too many wrong attempts. Please register again.", 429));
  }
  if (!user.otpExpire || user.otpExpire < Date.now()) {
    await user.deleteOne();
    return next(new AppError("OTP expired. Please register again.", 400));
  }
  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    const left = 5 - user.otpAttempts;
    return next(new AppError(`Invalid OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`, 400));
  }

  user.isVerified = true;
  user.otp = undefined; user.otpExpire = undefined;
  user.otpType = undefined; user.otpAttempts = 0; user.otpLastSent = undefined;
  await user.save();

  sendTokenResponse(user, 201, res, "Registration successful! Welcome to MultiShop 🎉");
});

// @route POST /api/auth/register/resend-otp
const registerResendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email, isVerified: false }).select("+otp +otpType");
  if (!user) return next(new AppError("No pending registration found.", 404));

  if (!canResendOTP(user)) {
    const s = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${s}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("register");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({ email, template: "otpVerification", data: { name: user.name, otp, type: "register" } });
  } catch { return next(new AppError("Failed to resend OTP.", 500)); }

  res.status(200).json({ success: true, message: `New OTP sent to ${email}.` });
});

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════

// @route POST /api/auth/login
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new AppError("Email and password are required.", 400));

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password)))
    return next(new AppError("Invalid email or password.", 401));
  if (!user.isVerified)
    return next(new AppError("Please verify your email with OTP before logging in.", 401));
  if (user.isBlocked)
    return next(new AppError("Your account has been suspended. Contact support.", 403));
  if (user.authProvider === "google")
    return next(new AppError("This account uses Google Sign-In. Please login with Google.", 400));

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });
  sendTokenResponse(user, 200, res, "Logged in successfully!");
});

// ══════════════════════════════════════════════════════════════
//  GOOGLE OAUTH — Two methods supported:
//  1. Google One Tap / GSI (credential token from frontend)
//  2. Standard OAuth2 code flow (redirect-based)
// ══════════════════════════════════════════════════════════════

// @route POST /api/auth/google
// Used when frontend sends Google credential (ID token from Google Sign-In button)
const googleLogin = asyncHandler(async (req, res, next) => {
  const { credential, code } = req.body;

  let googleId, email, name, picture, emailVerified;

  if (credential) {
    // ── Method 1: ID Token (Google One Tap / GSI button) ──────
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      emailVerified = payload.email_verified;
    } catch (err) {
      return next(new AppError("Invalid Google credential. Please try again.", 401));
    }
  } else if (code) {
    // ── Method 2: Authorization Code (OAuth2 redirect flow) ───
    try {
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.CLIENT_URL}/auth/google/callback`,
      });
      googleClient.setCredentials(tokens);
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      emailVerified = payload.email_verified;
    } catch (err) {
      return next(new AppError("Google authentication failed. Please try again.", 401));
    }
  } else {
    return next(new AppError("Google credential or authorization code is required.", 400));
  }

  if (!emailVerified) return next(new AppError("Google account email is not verified.", 400));

  // Find or create user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    // New user via Google
    user = await User.create({
      name,
      email,
      googleId,
      authProvider: "google",
      isVerified: true,
      avatar: { public_id: "", url: picture || "" },
    });
  } else {
    // Existing user — link Google if not already linked
    let changed = false;
    if (!user.googleId) { user.googleId = googleId; changed = true; }
    if (!user.isVerified) { user.isVerified = true; changed = true; }
    if (user.authProvider !== "google" && !user.password) {
      user.authProvider = "google"; changed = true;
    }
    if (!user.avatar?.url && picture) { user.avatar = { public_id: "", url: picture }; changed = true; }
    if (changed) await user.save({ validateBeforeSave: false });
  }

  if (user.isBlocked) return next(new AppError("Your account has been suspended.", 403));

  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, "Logged in with Google successfully!");
});

// ══════════════════════════════════════════════════════════════
//  LOGOUT
// ══════════════════════════════════════════════════════════════

// @route POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  res.cookie("token", "none", { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
  res.status(200).json({ success: true, message: "Logged out successfully." });
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.status(200).json({ success: true, data: user });
});

// ══════════════════════════════════════════════════════════════
//  FORGOT PASSWORD — OTP FLOW
// ══════════════════════════════════════════════════════════════

// @route POST /api/auth/forgot-password/send-otp
const forgotPasswordSendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError("Email is required.", 400));

  const user = await User.findOne({ email }).select("+otp +otpType");
  // Always return success to not reveal if email exists
  if (!user) return res.status(200).json({ success: true, message: "If an account exists, an OTP has been sent." });

  if (user.authProvider === "google")
    return next(new AppError("This account uses Google Sign-In. Password reset is not available.", 400));

  if (!canResendOTP(user)) {
    const s = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${s}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("forgot_password");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({ email, template: "otpVerification", data: { name: user.name, otp, type: "forgot_password" } });
  } catch {
    user.otp = undefined; user.otpExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Failed to send OTP. Try again.", 500));
  }

  res.status(200).json({ success: true, message: `OTP sent to ${email}. Valid for 10 minutes.`, data: { email } });
});

// @route POST /api/auth/forgot-password/verify-otp
const forgotPasswordVerifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return next(new AppError("Email and OTP are required.", 400));

  const user = await User.findOne({ email }).select("+otp +otpType");
  if (!user || user.otpType !== "forgot_password")
    return next(new AppError("No password reset request found. Please try again.", 404));

  if (user.otpAttempts >= 5) {
    user.otp = undefined; user.otpExpire = undefined; user.otpType = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError("Too many wrong attempts. Please request a new OTP.", 429));
  }
  if (!user.otpExpire || user.otpExpire < Date.now())
    return next(new AppError("OTP expired. Please request a new one.", 400));

  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    const left = 5 - user.otpAttempts;
    return next(new AppError(`Invalid OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`, 400));
  }

  // Issue short-lived reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
  user.otp = undefined; user.otpExpire = undefined;
  user.otpType = undefined; user.otpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: "OTP verified! Set your new password.", data: { resetToken } });
});

// @route POST /api/auth/forgot-password/resend-otp
const forgotPasswordResendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select("+otp +otpType");
  if (!user) return next(new AppError("No account with that email.", 404));

  if (!canResendOTP(user)) {
    const s = Math.ceil(60 - (Date.now() - new Date(user.otpLastSent).getTime()) / 1000);
    return next(new AppError(`Wait ${s}s before requesting a new OTP.`, 429));
  }

  const otp = user.generateOTP("forgot_password");
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({ email, template: "otpVerification", data: { name: user.name, otp, type: "forgot_password" } });
  } catch { return next(new AppError("Failed to resend OTP.", 500)); }

  res.status(200).json({ success: true, message: `New OTP sent to ${email}.` });
});

// @route PUT /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res, next) => {
  const { resetToken, password } = req.body;
  if (!resetToken || !password) return next(new AppError("Reset token and new password are required.", 400));

  const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");
  const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: Date.now() } });
  if (!user) return next(new AppError("Reset token is invalid or expired.", 400));

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, "Password reset successful! You are now logged in.");
});

module.exports = {
  registerSendOTP, registerVerifyOTP, registerResendOTP,
  login, googleLogin, logout, getMe,
  forgotPasswordSendOTP, forgotPasswordVerifyOTP, forgotPasswordResendOTP, resetPassword,
};