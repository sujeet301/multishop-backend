const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Product name is required"], trim: true, maxlength: 200 },
    description: { type: String, required: [true, "Description is required"], maxlength: 2000 },
    shortDescription: { type: String, maxlength: 300 },
    price: { type: Number, required: [true, "Price is required"], min: 0 },
    discountPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subCategory: { type: String, default: "" },
    brand: { type: String, default: "" },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sold: { type: Number, default: 0 },
    sku: { type: String, unique: true, sparse: true },
    tags: [String],
    specifications: [
      {
        key: String,
        value: String,
      },
    ],
    variants: [
      {
        name: String, // e.g. "Color", "Size"
        options: [
          {
            value: String,
            stock: Number,
            priceModifier: { type: Number, default: 0 },
          },
        ],
      },
    ],
    ratings: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isFlashSale: { type: Boolean, default: false },
    flashSalePrice: { type: Number, default: 0 },
    flashSaleEnd: Date,
    weight: { type: Number, default: 0 }, // in grams
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    gstRate: { type: Number, default: 18 }, // GST percentage
    hsn: { type: String, default: "" }, // HSN code for GST
    returnable: { type: Boolean, default: true },
    returnDays: { type: Number, default: 7 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Calculate discount percent before save
productSchema.pre("save", function (next) {
  if (this.discountPrice && this.price) {
    this.discountPercent = Math.round(((this.price - this.discountPrice) / this.price) * 100);
  }
  next();
});

// Full text search index
productSchema.index({ name: "text", description: "text", brand: "text", tags: "text" });
productSchema.index({ category: 1, price: 1, ratings: -1 });
productSchema.index({ seller: 1, isActive: 1 });

module.exports = mongoose.model("Product", productSchema);