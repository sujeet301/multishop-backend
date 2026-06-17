const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    shopName: { type: String, required: [true, "Shop name is required"], trim: true, maxlength: 100 },
    shopDescription: { type: String, maxlength: 500 },
    shopLogo: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    shopBanner: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    businessType: {
      type: String,
      enum: ["individual", "company", "partnership"],
      default: "individual",
    },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
    address: {
      addressLine1: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    rejectionReason: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 10 }, // platform commission %
  },
  { timestamps: true }
);

module.exports = mongoose.model("Seller", sellerSchema);