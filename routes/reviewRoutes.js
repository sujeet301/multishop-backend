const express = require("express");
const router = express.Router();
const { createReview, getProductReviews, voteHelpful } = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

router.get("/product/:productId", getProductReviews);
router.use(protect);
router.post("/", createReview);
router.put("/:id/helpful", voteHelpful);

module.exports = router;