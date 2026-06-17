const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    image: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
    },
    link: { type: String, default: "" },
    position: { type: String, enum: ["hero", "middle", "bottom", "popup"], default: "hero" },
    isActive: { type: Boolean, default: true },
    startDate: Date,
    endDate: Date,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "order_placed",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
        "payment_success",
        "payment_failed",
        "new_review",
        "seller_approved",
        "seller_rejected",
        "flash_sale",
        "new_message",
        "system",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // extra payload
    isRead: { type: Boolean, default: false },
    link: { type: String, default: "" },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Banner = mongoose.model("Banner", bannerSchema);
const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Banner, Notification };