const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  discountPrice: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1 },
  variant: {
    name: String,
    value: String,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"],
    default: "pending",
  },
  statusHistory: [
    {
      status: String,
      timestamp: { type: Date, default: Date.now },
      note: String,
    },
  ],
  trackingNumber: { type: String, default: "" },
  deliveredAt: Date,
  isReviewed: { type: Boolean, default: false },
});

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderNumber: { type: String, unique: true },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, default: "India" },
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "razorpay", "stripe"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentResult: {
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    coupon: {
      code: String,
      discount: Number,
    },
    pricing: {
      subtotal: { type: Number, required: true },
      shipping: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
    overallStatus: {
      type: String,
      enum: ["pending", "processing", "partially_shipped", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    notes: { type: String, default: "" },
    paidAt: Date,
  },
  { timestamps: true }
);

// Auto-generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `MS-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);