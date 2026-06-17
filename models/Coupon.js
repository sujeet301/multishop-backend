const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: 0 }, // max cap for percentage
    minOrderAmount: { type: Number, default: 0 },
    maxUsage: { type: Number, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    applicableFor: {
      type: String,
      enum: ["all", "category", "product", "seller"],
      default: "all",
    },
    applicableId: { type: mongoose.Schema.Types.ObjectId }, // category/product/seller id
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin or seller
    createdByRole: { type: String, enum: ["admin", "seller"] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);