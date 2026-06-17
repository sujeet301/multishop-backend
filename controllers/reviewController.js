const asyncHandler = require("express-async-handler");
const Review = require("../models/Review");
const Order = require("../models/Order");
const { AppError } = require("../middleware/errorMiddleware");

const createReview = asyncHandler(async (req, res, next) => {
  const { productId, orderId, rating, title, comment, sellerRating, sellerComment } = req.body;

  // Verify purchase
  const order = await Order.findOne({ _id: orderId, user: req.user._id, "items.product": productId });
  if (!order) return next(new AppError("You can only review products you've purchased.", 400));

  const item = order.items.find((i) => i.product.toString() === productId);
  if (item.isReviewed) return next(new AppError("You have already reviewed this product.", 400));
  if (item.status !== "delivered") return next(new AppError("You can only review delivered products.", 400));

  const review = await Review.create({
    user: req.user._id,
    product: productId,
    order: orderId,
    seller: item.seller,
    rating,
    title,
    comment,
    sellerRating,
    sellerComment,
    images: req.files?.map((f) => ({ public_id: f.filename, url: f.path })) || [],
  });

  item.isReviewed = true;
  await order.save();

  // Update seller rating if provided
  if (sellerRating) {
    const Seller = require("../models/Seller");
    const seller = await Seller.findById(item.seller);
    if (seller) {
      const newTotal = seller.totalRatings + 1;
      seller.rating = ((seller.rating * seller.totalRatings) + sellerRating) / newTotal;
      seller.totalRatings = newTotal;
      await seller.save();
    }
  }

  res.status(201).json({ success: true, message: "Review submitted! Thank you.", data: review });
});

const getProductReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort = "-createdAt", rating } = req.query;
  const query = { product: req.params.productId, isApproved: true };
  if (rating) query.rating = Number(rating);

  const total = await Review.countDocuments(query);
  const reviews = await Review.find(query)
    .populate("user", "name avatar")
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Rating distribution
  const distribution = await Review.aggregate([
    { $match: { product: require("mongoose").Types.ObjectId.createFromHexString(req.params.productId) } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
  ]);

  res.status(200).json({ success: true, total, data: reviews, distribution });
});

const voteHelpful = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError("Review not found.", 404));

  const alreadyVoted = review.helpfulVotes.includes(req.user._id);
  if (alreadyVoted) {
    review.helpfulVotes = review.helpfulVotes.filter((id) => id.toString() !== req.user._id.toString());
  } else {
    review.helpfulVotes.push(req.user._id);
  }
  await review.save();
  res.status(200).json({ success: true, helpfulCount: review.helpfulVotes.length, voted: !alreadyVoted });
});

module.exports = { createReview, getProductReviews, voteHelpful };