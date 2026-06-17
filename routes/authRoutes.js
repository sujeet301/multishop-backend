const express = require("express");
const router = express.Router();
const {
  registerSendOTP,
  registerVerifyOTP,
  registerResendOTP,
  login,
  googleLogin,
  logout,
  getMe,
  forgotPasswordSendOTP,
  forgotPasswordVerifyOTP,
  forgotPasswordResendOTP,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// ── Register OTP flow ──────────────────────────────────────────
router.post("/register/send-otp",    registerSendOTP);    // Step 1: enter details → get OTP
router.post("/register/verify-otp",  registerVerifyOTP);  // Step 2: enter OTP → account created
router.post("/register/resend-otp",  registerResendOTP);  // Resend OTP

// ── Auth ───────────────────────────────────────────────────────
router.post("/login",   login);
router.post("/google",  googleLogin);
router.post("/logout",  protect, logout);
router.get("/me",       protect, getMe);

// ── Forgot Password OTP flow ───────────────────────────────────
router.post("/forgot-password/send-otp",   forgotPasswordSendOTP);   // Step 1: enter email → get OTP
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOTP); // Step 2: enter OTP → get resetToken
router.post("/forgot-password/resend-otp", forgotPasswordResendOTP); // Resend OTP
router.put("/reset-password",              resetPassword);            // Step 3: enter new password

module.exports = router;