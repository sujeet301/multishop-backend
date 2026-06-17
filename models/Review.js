const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 100 },
    comment: { type: String, required: true, maxlength: 1000 },
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    sellerRating: { type: Number, min: 1, max: 5 },
    sellerComment: { type: String, maxlength: 500 },
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isVerifiedPurchase: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One review per product per order
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

// Update product ratings after review save
reviewSchema.post("save", async function () {
  const Product = mongoose.model("Product");
  const stats = await mongoose.model("Review").aggregate([
    { $match: { product: this.product } },
    { $group: { _id: "$product", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.product, {
      ratings: Math.round(stats[0].avgRating * 10) / 10,
      numReviews: stats[0].count,
    });
  }
});

module.exports = mongoose.model("Review", reviewSchema);