# MultiShop Backend API 🛍️

A production-ready Node.js/Express REST API for the MultiShop e-commerce platform.

## 🚀 Quick Start

```bash
cd backend
npm install
cp .env.example .env      # Fill in your credentials
npm run seed              # Seed categories + admin user
npm run dev               # Start dev server
```

API runs at: `http://localhost:5000/api`

## 🗂️ Folder Structure

```
backend/
├── config/
│   ├── db.js                 # MongoDB connection
│   └── cloudinary.js         # Cloudinary + Multer config
├── controllers/
│   ├── authController.js     # Register, login, Google OAuth, password reset
│   ├── userController.js     # Profile, addresses, password change
│   ├── sellerController.js   # Seller registration, dashboard
│   ├── adminController.js    # Admin panel, user/seller management
│   ├── productController.js  # CRUD, search, filters, flash sale
│   ├── orderController.js    # Order lifecycle, status tracking
│   ├── cartController.js     # Cart management
│   ├── wishlistController.js # Wishlist toggle, move to cart
│   ├── reviewController.js   # Reviews, ratings, helpful votes
│   ├── paymentController.js  # Razorpay + Stripe integration
│   └── miscControllers.js    # Categories, coupons, banners, notifications, analytics
├── middleware/
│   ├── authMiddleware.js     # JWT protect, role-based auth, seller attach
│   └── errorMiddleware.js    # Global error handler + AppError class
├── models/
│   ├── User.js               # User with addresses, wishlist, JWT methods
│   ├── Seller.js             # Seller profile, status, bank details
│   ├── Product.js            # Full product with variants, flash sale, specs
│   ├── Category.js           # Hierarchical categories
│   ├── Order.js              # Order with per-item status tracking
│   ├── Review.js             # Verified purchase reviews, seller rating
│   ├── Cart.js               # Cart with save-for-later
│   ├── Coupon.js             # Percentage/fixed coupons with limits
│   └── Banner.js             # Banners + Notifications
├── routes/                   # Express routers (one per domain)
├── utils/
│   ├── sendEmail.js          # Nodemailer with HTML templates
│   ├── tokenHelper.js        # JWT cookie response helper
│   ├── notificationHelper.js # Create + emit Socket.IO notifications
│   ├── socketHandler.js      # Socket.IO event handlers
│   └── seeder.js             # Database seeder
├── server.js                 # Express app entry point
├── package.json
└── .env.example
```

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| GET | `/api/auth/verify-email/:token` | Verify email |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/forgot-password` | Forgot password |
| PUT | `/api/auth/reset-password/:token` | Reset password |
| GET | `/api/auth/me` | Get current user |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (search, filter, sort, paginate) |
| GET | `/api/products/:id` | Get product detail |
| POST | `/api/products` | Create product (seller) |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| PUT | `/api/products/:id/flash-sale` | Toggle flash sale |

### Query Params for `/api/products`
- `keyword` — full-text search
- `category` — category slug or ID
- `brand` — comma-separated brands
- `minPrice`, `maxPrice`
- `minRating`
- `inStock=true`
- `isFlashSale=true`, `isFeatured=true`
- `sort` — `price_asc | price_desc | newest | best_selling | top_rated | relevance`
- `page`, `limit`

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Place order (COD/Razorpay/Stripe) |
| GET | `/api/orders/my-orders` | User's orders |
| GET | `/api/orders/seller-orders` | Seller's orders |
| GET | `/api/orders/admin/all` | All orders (admin) |
| GET | `/api/orders/:id` | Single order |
| PUT | `/api/orders/:id/cancel` | Cancel order |
| PUT | `/api/orders/:orderId/items/:itemId/status` | Update item status (seller) |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/razorpay/create-order` | Create Razorpay order |
| POST | `/api/payments/razorpay/verify` | Verify Razorpay payment |
| POST | `/api/payments/stripe/create-intent` | Create Stripe PaymentIntent |
| POST | `/api/payments/stripe/webhook` | Stripe webhook |

## 🔐 Authentication

All protected routes require `Authorization: Bearer <token>` header or `token` cookie.

### Roles
- `user` — customer
- `seller` — approved seller
- `admin` — platform admin

## 🌐 Real-Time (Socket.IO)

Connect to `http://localhost:5000` and emit `join` with userId to receive notifications.

```js
socket.emit("join", userId);
socket.on("notification", (data) => console.log(data));
```

## 🌱 Default Credentials (after seed)

- **Admin:** admin@multishop.com / Admin@123
