const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("../config/db");
const User = require("../models/User");
const Seller = require("../models/Seller");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Coupon = require("../models/Coupon");
const { Banner } = require("../models/Banner");
const Order = require("../models/Order");

// ─── CATEGORIES ───────────────────────────────────────────────
const categories = [
  { name: "Electronics", slug: "electronics", icon: "💻", order: 1, description: "Gadgets, phones, laptops and more" },
  { name: "Fashion", slug: "fashion", icon: "👗", order: 2, description: "Clothing, shoes and accessories" },
  { name: "Home & Living", slug: "home-living", icon: "🏠", order: 3, description: "Furniture, décor and appliances" },
  { name: "Sports", slug: "sports", icon: "⚽", order: 4, description: "Sports gear and fitness equipment" },
  { name: "Books", slug: "books", icon: "📚", order: 5, description: "Books, e-books and stationery" },
  { name: "Beauty", slug: "beauty", icon: "💄", order: 6, description: "Skincare, makeup and wellness" },
  { name: "Toys", slug: "toys", icon: "🧸", order: 7, description: "Toys and games for all ages" },
  { name: "Grocery", slug: "grocery", icon: "🛒", order: 8, description: "Fresh food and daily essentials" },
];

// ─── USERS ────────────────────────────────────────────────────
const users = [
  {
    name: "Admin User",
    email: "admin@multishop.com",
    password: "Admin@123",
    role: "admin",
    isVerified: true,
    phone: "+91 9000000001",
    avatar: { url: "https://ui-avatars.com/api/?name=Admin+User&background=6366f1&color=fff&size=128" },
  },
  {
    name: "Tech Seller",
    email: "seller1@multishop.com",
    password: "Seller@123",
    role: "seller",
    isVerified: true,
    phone: "+91 9000000002",
    avatar: { url: "https://ui-avatars.com/api/?name=Tech+Seller&background=10b981&color=fff&size=128" },
  },
  {
    name: "Fashion Hub",
    email: "seller2@multishop.com",
    password: "Seller@123",
    role: "seller",
    isVerified: true,
    phone: "+91 9000000003",
    avatar: { url: "https://ui-avatars.com/api/?name=Fashion+Hub&background=f59e0b&color=fff&size=128" },
  },
  {
    name: "Rahul Sharma",
    email: "user1@multishop.com",
    password: "User@123",
    role: "user",
    isVerified: true,
    phone: "+91 9000000004",
    avatar: { url: "https://ui-avatars.com/api/?name=Rahul+Sharma&background=3b82f6&color=fff&size=128" },
    addresses: [{
      fullName: "Rahul Sharma",
      phone: "+91 9000000004",
      addressLine1: "123, MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      isDefault: true,
    }],
  },
  {
    name: "Priya Singh",
    email: "user2@multishop.com",
    password: "User@123",
    role: "user",
    isVerified: true,
    phone: "+91 9000000005",
    avatar: { url: "https://ui-avatars.com/api/?name=Priya+Singh&background=ec4899&color=fff&size=128" },
  },
];

// ─── SELLER PROFILES ──────────────────────────────────────────
const sellerProfiles = [
  {
    email: "seller1@multishop.com",
    profile: {
      shopName: "TechZone India",
      shopDescription: "India's most trusted electronics store. Quality gadgets at unbeatable prices since 2020.",
      businessType: "company",
      gstNumber: "29ABCDE1234F1Z5",
      panNumber: "ABCDE1234F",
      status: "approved",
      rating: 4.7,
      totalRatings: 238,
      totalProducts: 45,
      totalOrders: 1240,
      totalRevenue: 2450000,
      commissionRate: 10,
      address: { addressLine1: "45 Koramangala", city: "Bengaluru", state: "Karnataka", pincode: "560034", country: "India" },
      bankDetails: { accountHolderName: "TechZone India Pvt Ltd", accountNumber: "1234567890", ifscCode: "HDFC0001234", bankName: "HDFC Bank" },
    },
  },
  {
    email: "seller2@multishop.com",
    profile: {
      shopName: "FashionForward",
      shopDescription: "Trendy fashion for men, women and kids. New arrivals every week!",
      businessType: "individual",
      gstNumber: "27FGHIJ5678K2L6",
      panNumber: "FGHIJ5678K",
      status: "approved",
      rating: 4.4,
      totalRatings: 156,
      totalProducts: 62,
      totalOrders: 870,
      totalRevenue: 1380000,
      commissionRate: 10,
      address: { addressLine1: "12 Linking Road, Bandra", city: "Mumbai", state: "Maharashtra", pincode: "400050", country: "India" },
      bankDetails: { accountHolderName: "Fashion Forward", accountNumber: "9876543210", ifscCode: "ICIC0009876", bankName: "ICICI Bank" },
    },
  },
];

// ─── PRODUCTS ─────────────────────────────────────────────────
const productTemplates = [
  // Electronics
  {
    name: "iPhone 15 Pro Max 256GB",
    description: "The latest Apple iPhone 15 Pro Max with 256GB storage, featuring the A17 Pro chip, ProMotion display at 120Hz, and a professional camera system with 5x optical zoom. Experience console-level gaming and stunning photography.",
    shortDescription: "A17 Pro chip, 5x zoom, 120Hz ProMotion — the most powerful iPhone ever.",
    price: 159900, discountPrice: 149900,
    brand: "Apple", categorySlug: "electronics", stock: 35, sold: 412,
    ratings: 4.8, numReviews: 312,
    tags: ["apple", "iphone", "smartphone", "5g"],
    specifications: [
      { key: "Display", value: "6.7-inch Super Retina XDR" },
      { key: "Chip", value: "Apple A17 Pro" },
      { key: "Storage", value: "256GB" },
      { key: "Camera", value: "48MP Main + 12MP Ultra Wide + 12MP 5x Telephoto" },
      { key: "Battery", value: "4422 mAh" },
      { key: "OS", value: "iOS 17" },
    ],
    isFeatured: true, gstRate: 18,
    images: [
      { public_id: "iphone15_1", url: "https://images.unsplash.com/photo-1695048133142-1a20484429be?w=600&q=80" },
      { public_id: "iphone15_2", url: "https://images.unsplash.com/photo-1696446702183-8b4b42e7e3e1?w=600&q=80" },
    ],
  },
  {
    name: "Samsung Galaxy S24 Ultra 5G",
    description: "Samsung's flagship phone with built-in S Pen, 200MP camera, Snapdragon 8 Gen 3 processor, and 5000mAh battery. The ultimate Android experience.",
    shortDescription: "200MP camera, built-in S Pen, Snapdragon 8 Gen 3.",
    price: 134999, discountPrice: 119999,
    brand: "Samsung", categorySlug: "electronics", stock: 28, sold: 298,
    ratings: 4.6, numReviews: 198,
    tags: ["samsung", "android", "5g", "spen"],
    specifications: [
      { key: "Display", value: "6.8-inch QHD+ AMOLED" },
      { key: "Processor", value: "Snapdragon 8 Gen 3" },
      { key: "Camera", value: "200MP + 12MP + 10MP + 50MP" },
      { key: "Battery", value: "5000 mAh" },
      { key: "RAM", value: "12GB" },
    ],
    isFeatured: true, isFlashSale: true,
    flashSalePrice: 109999,
    flashSaleEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    gstRate: 18,
    images: [
      { public_id: "s24_1", url: "https://images.unsplash.com/photo-1706525884595-a02b8b9a04b5?w=600&q=80" },
    ],
  },
  {
    name: "Sony WH-1000XM5 Noise Cancelling Headphones",
    description: "Industry-leading noise cancellation with 30-hour battery life and crystal-clear hands-free calling. Multipoint connection lets you pair with two devices simultaneously.",
    shortDescription: "Best-in-class noise cancellation, 30h battery, Hi-Res Audio.",
    price: 29990, discountPrice: 24990,
    brand: "Sony", categorySlug: "electronics", stock: 74, sold: 867,
    ratings: 4.9, numReviews: 654,
    tags: ["sony", "headphones", "noise-cancelling", "wireless"],
    specifications: [
      { key: "Type", value: "Over-ear wireless" },
      { key: "Battery", value: "30 hours" },
      { key: "Connectivity", value: "Bluetooth 5.2" },
      { key: "Weight", value: "250g" },
    ],
    isFeatured: true, gstRate: 18,
    images: [
      { public_id: "sony_xm5", url: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80" },
    ],
  },
  {
    name: "MacBook Air M3 13-inch",
    description: "Powered by the Apple M3 chip, this impossibly thin laptop delivers blazing performance and all-day battery life. Up to 18 hours of battery, stunning Liquid Retina display.",
    shortDescription: "M3 chip, 18h battery, Liquid Retina display — no fan needed.",
    price: 114900, discountPrice: 107900,
    brand: "Apple", categorySlug: "electronics", stock: 18, sold: 156,
    ratings: 4.8, numReviews: 124,
    tags: ["apple", "macbook", "laptop", "m3"],
    specifications: [
      { key: "Chip", value: "Apple M3 8-core CPU" },
      { key: "Memory", value: "8GB Unified Memory" },
      { key: "Storage", value: "256GB SSD" },
      { key: "Display", value: "13.6-inch Liquid Retina" },
      { key: "Battery", value: "Up to 18 hours" },
    ],
    isFeatured: true, gstRate: 18,
    images: [
      { public_id: "macbook_m3", url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&q=80" },
    ],
  },

  // Fashion
  {
    name: "Men's Classic Oxford Shirt",
    description: "Premium 100% Egyptian cotton Oxford shirt for formal and semi-formal occasions. Available in multiple colors with a regular fit that flatters all body types. Machine washable.",
    shortDescription: "100% Egyptian cotton, regular fit, wrinkle-resistant.",
    price: 2499, discountPrice: 1799,
    brand: "Arrow", categorySlug: "fashion", stock: 145, sold: 1243,
    ratings: 4.3, numReviews: 456,
    tags: ["shirt", "formal", "cotton", "men"],
    specifications: [
      { key: "Material", value: "100% Egyptian Cotton" },
      { key: "Fit", value: "Regular Fit" },
      { key: "Care", value: "Machine Washable" },
      { key: "Occasion", value: "Formal / Semi-Formal" },
    ],
    isFeatured: false, gstRate: 5,
    images: [
      { public_id: "oxford_shirt", url: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80" },
    ],
  },
  {
    name: "Women's Floral Maxi Dress",
    description: "Elegant floral print maxi dress made from breathable georgette fabric. Perfect for parties, weddings, and festive occasions. Features a V-neck and flared bottom.",
    shortDescription: "Georgette floral dress, V-neck, perfect for festive occasions.",
    price: 3499, discountPrice: 2299,
    brand: "W for Woman", categorySlug: "fashion", stock: 87, sold: 634,
    ratings: 4.5, numReviews: 312,
    tags: ["dress", "women", "floral", "ethnic"],
    specifications: [
      { key: "Material", value: "Georgette" },
      { key: "Neck", value: "V-Neck" },
      { key: "Length", value: "Maxi (Full Length)" },
      { key: "Occasion", value: "Party / Wedding / Festival" },
    ],
    isFeatured: true, isFlashSale: true,
    flashSalePrice: 1999,
    flashSaleEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
    gstRate: 5,
    images: [
      { public_id: "maxi_dress", url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80" },
    ],
  },
  {
    name: "Nike Air Max 270 Sneakers",
    description: "The Nike Air Max 270 draws inspiration from our Air Max icons. Designed for all-day wear, this shoe features Nike's biggest heel Air unit yet for a super-soft ride.",
    shortDescription: "Biggest heel Air unit, breathable mesh upper, iconic Nike style.",
    price: 12995, discountPrice: 9995,
    brand: "Nike", categorySlug: "fashion", stock: 62, sold: 489,
    ratings: 4.6, numReviews: 389,
    tags: ["nike", "sneakers", "airmax", "shoes"],
    specifications: [
      { key: "Upper", value: "Engineered Mesh" },
      { key: "Sole", value: "Air Max Unit" },
      { key: "Closure", value: "Lace-up" },
      { key: "Weight", value: "311g per shoe" },
    ],
    isFeatured: true, gstRate: 12,
    images: [
      { public_id: "nike_am270", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80" },
    ],
  },

  // Home & Living
  {
    name: "Ergonomic Office Chair with Lumbar Support",
    description: "Professional ergonomic office chair with adjustable lumbar support, armrests, and headrest. Breathable mesh back keeps you cool during long working hours. 360-degree swivel with smooth rolling casters.",
    shortDescription: "Adjustable lumbar, headrest, breathable mesh, 5-year warranty.",
    price: 18999, discountPrice: 13999,
    brand: "Green Soul", categorySlug: "home-living", stock: 43, sold: 298,
    ratings: 4.4, numReviews: 234,
    tags: ["chair", "office", "ergonomic", "furniture"],
    specifications: [
      { key: "Material", value: "Breathable Mesh + PU Leather" },
      { key: "Weight Capacity", value: "120 kg" },
      { key: "Seat Height", value: "45-55 cm (adjustable)" },
      { key: "Warranty", value: "5 Years" },
    ],
    isFeatured: false, gstRate: 18,
    images: [
      { public_id: "office_chair", url: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=600&q=80" },
    ],
  },

  // Sports
  {
    name: "Yoga Mat Premium Anti-Slip 6mm",
    description: "Professional-grade yoga mat with double-sided non-slip surface and alignment lines. Made from eco-friendly TPE material. Comes with carrying strap. Perfect for yoga, pilates, and floor exercises.",
    shortDescription: "Eco TPE material, alignment lines, non-slip both sides, 6mm thick.",
    price: 1999, discountPrice: 1299,
    brand: "Boldfit", categorySlug: "sports", stock: 234, sold: 1876,
    ratings: 4.5, numReviews: 1234,
    tags: ["yoga", "mat", "fitness", "exercise"],
    specifications: [
      { key: "Material", value: "Eco-friendly TPE" },
      { key: "Thickness", value: "6mm" },
      { key: "Dimensions", value: "183cm x 61cm" },
      { key: "Weight", value: "1.1 kg" },
    ],
    isFeatured: false, isFlashSale: true,
    flashSalePrice: 999,
    flashSaleEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    gstRate: 12,
    images: [
      { public_id: "yoga_mat", url: "https://images.unsplash.com/photo-1601925228988-18abd0dd6669?w=600&q=80" },
    ],
  },

  // Beauty
  {
    name: "The Ordinary Skincare Starter Kit",
    description: "Complete skincare starter set including Hyaluronic Acid 2% + B5 serum, Niacinamide 10% + Zinc 1% serum, and Glycolic Acid 7% toning solution. Dermatologist recommended for all skin types.",
    shortDescription: "3-piece set: HA serum, Niacinamide serum, and Glycolic toner.",
    price: 2499, discountPrice: 1899,
    brand: "The Ordinary", categorySlug: "beauty", stock: 178, sold: 2341,
    ratings: 4.7, numReviews: 1876,
    tags: ["skincare", "serum", "hyaluronic", "niacinamide"],
    specifications: [
      { key: "Skin Type", value: "All skin types" },
      { key: "Items", value: "3 bottles" },
      { key: "Cruelty-free", value: "Yes" },
      { key: "Vegan", value: "Yes" },
    ],
    isFeatured: true, gstRate: 12,
    images: [
      { public_id: "skincare_kit", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80" },
    ],
  },
];

// ─── COUPONS ──────────────────────────────────────────────────
const coupons = [
  {
    code: "WELCOME20",
    description: "20% off for new users",
    discountType: "percentage",
    discountValue: 20,
    maxDiscount: 500,
    minOrderAmount: 500,
    maxUsage: 1000,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdByRole: "admin",
  },
  {
    code: "FLAT200",
    description: "₹200 flat off on orders above ₹1000",
    discountType: "fixed",
    discountValue: 200,
    minOrderAmount: 1000,
    maxUsage: 500,
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdByRole: "admin",
  },
  {
    code: "TECH10",
    description: "10% off on electronics (max ₹2000)",
    discountType: "percentage",
    discountValue: 10,
    maxDiscount: 2000,
    minOrderAmount: 5000,
    maxUsage: 200,
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdByRole: "admin",
  },
  {
    code: "FREESHIP",
    description: "Free shipping on any order",
    discountType: "fixed",
    discountValue: 49,
    minOrderAmount: 0,
    maxUsage: 0,
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdByRole: "admin",
  },
  {
    code: "FASHION30",
    description: "30% off on fashion items",
    discountType: "percentage",
    discountValue: 30,
    maxDiscount: 800,
    minOrderAmount: 999,
    maxUsage: 300,
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdByRole: "admin",
  },
];

// ─── SEED FUNCTION ────────────────────────────────────────────
const seedDB = async () => {
  await connectDB();

  console.log("\n🌱 Starting MultiShop database seeding...\n");

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Seller.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Coupon.deleteMany({}),
    Order.deleteMany({}),
  ]);
  console.log("🗑️  Cleared existing data");

  // Seed Categories
  const createdCats = await Category.insertMany(categories);
  const catMap = {};
  createdCats.forEach(c => { catMap[c.slug] = c._id; });
  console.log(`✅ Categories: ${createdCats.length} created`);

  // Seed Users
  const createdUsers = [];
  for (const u of users) {
    
    const user = await User.create({
      ...u,
    });
    createdUsers.push(user);
  }
  const userMap = {};
  createdUsers.forEach(u => { userMap[u.email] = u; });
  console.log(`✅ Users: ${createdUsers.length} created`);

  // Seed Seller profiles
  const createdSellers = [];
  for (const s of sellerProfiles) {
    const user = userMap[s.email];
    const seller = await Seller.create({ ...s.profile, user: user._id });
    createdSellers.push(seller);
  }
  const sellerByEmail = {};
  sellerProfiles.forEach((s, i) => { sellerByEmail[s.email] = createdSellers[i]; });
  console.log(`✅ Seller profiles: ${createdSellers.length} created`);

  // Seed Products (split between 2 sellers)
  const seller1 = sellerByEmail["seller1@multishop.com"];
  const seller2 = sellerByEmail["seller2@multishop.com"];
  const electronicsSlugs = ["electronics", "sports", "beauty", "home-living", "books", "grocery"];
  const fashionSlugs = ["fashion"];

  const createdProducts = [];
  for (const [i, p] of productTemplates.entries()) {
    const seller = fashionSlugs.includes(p.categorySlug) ? seller2 : seller1;
    const product = await Product.create({
      ...p,
      category: catMap[p.categorySlug],
      seller: seller._id,
    });
    createdProducts.push(product);
  }
  console.log(`✅ Products: ${createdProducts.length} created`);

  // Seed Coupons
  const adminUser = userMap["admin@multishop.com"];
  const createdCoupons = await Coupon.insertMany(
    coupons.map(c => ({ ...c, createdBy: adminUser._id }))
  );
  console.log(`✅ Coupons: ${createdCoupons.length} created`);

  // Seed sample order
  const buyerUser = userMap["user1@multishop.com"];
  const sampleProduct = createdProducts[0];
  const sampleOrder = await Order.create({
    user: buyerUser._id,
    items: [{
      product: sampleProduct._id,
      seller: seller1._id,
      name: sampleProduct.name,
      image: sampleProduct.images[0].url,
      price: sampleProduct.price,
      discountPrice: sampleProduct.discountPrice,
      quantity: 1,
      status: "delivered",
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      statusHistory: [
        { status: "pending", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), note: "Order placed" },
        { status: "processing", timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
        { status: "shipped", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), note: "Shipped via BlueDart" },
        { status: "delivered", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      ],
    }],
    shippingAddress: buyerUser.addresses[0],
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    overallStatus: "delivered",
    pricing: {
      subtotal: sampleProduct.discountPrice,
      shipping: 0,
      gst: Math.round(sampleProduct.discountPrice * 0.18),
      discount: 0,
      total: sampleProduct.discountPrice + Math.round(sampleProduct.discountPrice * 0.18),
    },
  });
  console.log(`✅ Sample order created: ${sampleOrder.orderNumber}`);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(55));
  console.log("🎉  MultiShop database seeded successfully!\n");
  console.log("🔑  LOGIN CREDENTIALS\n" + "─".repeat(55));
  console.log("👑  ADMIN");
  console.log("    Email   : admin@multishop.com");
  console.log("    Password: Admin@123\n");
  console.log("🏪  SELLER 1 (Electronics — TechZone India)");
  console.log("    Email   : seller1@multishop.com");
  console.log("    Password: Seller@123\n");
  console.log("🏪  SELLER 2 (Fashion — FashionForward)");
  console.log("    Email   : seller2@multishop.com");
  console.log("    Password: Seller@123\n");
  console.log("🛍️  CUSTOMER 1");
  console.log("    Email   : user1@multishop.com");
  console.log("    Password: User@123\n");
  console.log("🛍️  CUSTOMER 2");
  console.log("    Email   : user2@multishop.com");
  console.log("    Password: User@123\n");
  console.log("🎟️  COUPON CODES");
  console.log("    WELCOME20 — 20% off (max ₹500, min order ₹500)");
  console.log("    FLAT200   — ₹200 off (min order ₹1000)");
  console.log("    TECH10    — 10% off electronics (max ₹2000)");
  console.log("    FREESHIP  — Free shipping on any order");
  console.log("    FASHION30 — 30% off fashion (max ₹800)");
  console.log("═".repeat(55) + "\n");

  process.exit(0);
};

seedDB().catch(err => {
  console.error("❌ Seeder failed:", err.message);
  process.exit(1);
});
