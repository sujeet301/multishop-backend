const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  variant: {
    name: String,
    value: String,
  },
  savedForLater: { type: Boolean, default: false },
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [cartItemSchema],
    couponApplied: {
      code: String,
      discount: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);