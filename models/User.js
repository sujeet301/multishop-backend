const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: "India" },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 50 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phone: { type: String, default: "" },
    avatar: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "https://res.cloudinary.com/demo/image/upload/v1/samples/people/boy-snow-hoodie" },
    },
    role: { type: String, enum: ["user", "seller", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    googleId: { type: String, default: "" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    addresses: [addressSchema],
    savedCards: [
      {
        last4: String,
        brand: String,
        expMonth: Number,
        expYear: Number,
        stripePaymentMethodId: String,
      },
    ],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    lastLogin: Date,
    // OTP fields
    otp: { type: String, select: false },
    otpExpire: { type: Date },
    otpType: { type: String, enum: ["register", "forgot_password"], select: false },
    otpAttempts: { type: Number, default: 0 },
    otpLastSent: { type: Date },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Generate reset password token
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 min
  return resetToken;
};

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function () {
  const verifyToken = crypto.randomBytes(20).toString("hex");
  this.emailVerificationToken = crypto.createHash("sha256").update(verifyToken).digest("hex");
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verifyToken;
};

// Generate 6-digit OTP
userSchema.methods.generateOTP = function (type) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.otpType = type;
  this.otpAttempts = 0;
  this.otpLastSent = Date.now();
  return otp;
};

// Verify OTP
userSchema.methods.verifyOTP = function (enteredOtp) {
  const hashed = crypto.createHash("sha256").update(enteredOtp).digest("hex");
  return this.otp === hashed && this.otpExpire > Date.now();
};

module.exports = mongoose.model("User", userSchema);