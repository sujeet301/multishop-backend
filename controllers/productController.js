const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const Category = require("../models/Category");
const { AppError } = require("../middleware/errorMiddleware");
const { cloudinary } = require("../config/cloudinary");

// @desc    Get all products (with search, filter, sort, pagination)
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const {
    keyword,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    inStock,
    sort,
    page = 1,
    limit = 12,
    isFlashSale,
    isFeatured,
    seller,
  } = req.query;

  const query = { isActive: true };

  // Text search
  if (keyword) {
    query.$text = { $search: keyword };
  }

  // Category filter (supports slug or id)
  if (category) {
    const cat = await Category.findOne({ $or: [{ slug: category }, { _id: category }] });
    if (cat) query.category = cat._id;
  }

  // Brand filter
  if (brand) {
    query.brand = { $in: brand.split(",").map((b) => new RegExp(b.trim(), "i")) };
  }

  // Price filter
  if (minPrice || maxPrice) {
    query.$or = [
      { discountPrice: { $gte: Number(minPrice) || 0, $lte: Number(maxPrice) || Infinity } },
      {
        $and: [
          { discountPrice: 0 },
          { price: { $gte: Number(minPrice) || 0, $lte: Number(maxPrice) || Infinity } },
        ],
      },
    ];
  }

  // Rating filter
  if (minRating) query.ratings = { $gte: Number(minRating) };

  // Stock filter
  if (inStock === "true") query.stock = { $gt: 0 };

  // Flash sale / featured
  if (isFlashSale === "true") {
    query.isFlashSale = true;
    query.flashSaleEnd = { $gt: new Date() };
  }
  if (isFeatured === "true") query.isFeatured = true;

  // Seller filter
  if (seller) query.seller = seller;

  // Sorting
  let sortObj = {};
  switch (sort) {
    case "price_asc":    sortObj = { price: 1 };       break;
    case "price_desc":   sortObj = { price: -1 };      break;
    case "newest":       sortObj = { createdAt: -1 };  break;
    case "best_selling": sortObj = { sold: -1 };       break;
    case "top_rated":    sortObj = { ratings: -1 };    break;
    case "relevance":    sortObj = keyword ? { score: { $meta: "textScore" } } : { createdAt: -1 }; break;
    default:             sortObj = { createdAt: -1 };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Product.countDocuments(query);

  let productQuery = Product.find(query)
    .populate("category", "name slug")
    .populate("seller", "shopName shopLogo rating")
    .select("-specifications -variants")
    .sort(sortObj)
    .skip(skip)
    .limit(Number(limit));

  if (keyword && sort === "relevance") {
    productQuery = productQuery.select({ score: { $meta: "textScore" } });
  }

  const products = await productQuery;

  // Get distinct brands for filter sidebar
  const brands = await Product.distinct("brand", { isActive: true, ...(category && query.category ? { category: query.category } : {}) });

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: Number(page),
    data: products,
    filters: { brands: brands.filter(Boolean) },
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name slug")
    .populate({
      path: "seller",
      select: "shopName shopLogo shopDescription rating totalOrders user",
      populate: { path: "user", select: "name" },
    });

  if (!product || !product.isActive) return next(new AppError("Product not found.", 404));

  // Increment view count
  await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  // Related products
  const related = await Product.find({
    category: product.category._id,
    _id: { $ne: product._id },
    isActive: true,
  })
    .limit(8)
    .select("name price discountPrice images ratings numReviews sold");

  res.status(200).json({ success: true, data: product, related });
});

// @desc    Create product (seller only)
// @route   POST /api/products
// @access  Private/Seller
const createProduct = asyncHandler(async (req, res, next) => {
  const { name, description, shortDescription, price, discountPrice, category, brand, stock, tags, specifications, variants, gstRate, weight, dimensions, returnable, returnDays, hsn } = req.body;

  if (!req.files || req.files.length === 0) {
    return next(new AppError("Please upload at least one product image.", 400));
  }

  const images = req.files.map((file) => ({
    public_id: file.filename,
    url: file.path,
  }));

  const product = await Product.create({
    name,
    description,
    shortDescription,
    price,
    discountPrice: discountPrice || 0,
    images,
    category,
    brand,
    stock,
    seller: req.seller._id,
    tags: tags ? JSON.parse(tags) : [],
    specifications: specifications ? JSON.parse(specifications) : [],
    variants: variants ? JSON.parse(variants) : [],
    gstRate: gstRate || 18,
    weight,
    dimensions: dimensions ? JSON.parse(dimensions) : {},
    returnable: returnable !== undefined ? returnable : true,
    returnDays: returnDays || 7,
    hsn,
  });

  // Update seller product count
  await require("../models/Seller").findByIdAndUpdate(req.seller._id, { $inc: { totalProducts: 1 } });

  res.status(201).json({ success: true, message: "Product created successfully!", data: product });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Seller or Admin
const updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found.", 404));

  // Seller can only edit own products
  if (req.user.role === "seller" && product.seller.toString() !== req.seller._id.toString()) {
    return next(new AppError("Not authorized to edit this product.", 403));
  }

  // Handle new images if uploaded
  if (req.files && req.files.length > 0) {
    const newImages = req.files.map((f) => ({ public_id: f.filename, url: f.path }));
    req.body.images = [...(product.images || []), ...newImages];
  }

  // Parse JSON fields
  ["tags", "specifications", "variants", "dimensions"].forEach((field) => {
    if (req.body[field] && typeof req.body[field] === "string") {
      req.body[field] = JSON.parse(req.body[field]);
    }
  });

  product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: "Product updated!", data: product });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Seller or Admin
const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found.", 404));

  if (req.user.role === "seller" && product.seller.toString() !== req.seller._id.toString()) {
    return next(new AppError("Not authorized to delete this product.", 403));
  }

  // Delete images from cloudinary
  for (const img of product.images) {
    if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
  }

  await product.deleteOne();
  await require("../models/Seller").findByIdAndUpdate(product.seller, { $inc: { totalProducts: -1 } });

  res.status(200).json({ success: true, message: "Product deleted successfully." });
});

// @desc    Delete a single product image
// @route   DELETE /api/products/:id/images/:publicId
// @access  Private/Seller
const deleteProductImage = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found.", 404));

  if (product.seller.toString() !== req.seller._id.toString()) {
    return next(new AppError("Not authorized.", 403));
  }

  const publicId = decodeURIComponent(req.params.publicId);
  await cloudinary.uploader.destroy(publicId);
  product.images = product.images.filter((img) => img.public_id !== publicId);
  await product.save();

  res.status(200).json({ success: true, message: "Image deleted.", data: product });
});

// @desc    Toggle flash sale
// @route   PUT /api/products/:id/flash-sale
// @access  Private/Seller
const toggleFlashSale = asyncHandler(async (req, res, next) => {
  const { isFlashSale, flashSalePrice, flashSaleEnd } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError("Product not found.", 404));
  if (product.seller.toString() !== req.seller._id.toString()) return next(new AppError("Not authorized.", 403));

  product.isFlashSale = isFlashSale;
  product.flashSalePrice = flashSalePrice || 0;
  product.flashSaleEnd = flashSaleEnd ? new Date(flashSaleEnd) : undefined;
  await product.save();

  res.status(200).json({ success: true, message: `Flash sale ${isFlashSale ? "activated" : "deactivated"}!`, data: product });
});

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, deleteProductImage, toggleFlashSale };