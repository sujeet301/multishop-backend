const express = require("express");
const router = express.Router();
const { getDashboard, getUsers, toggleUserBlock, deleteUser, getSellers, updateSellerStatus, getRevenueOverview } = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.use(protect, authorize("admin"));
router.get("/dashboard", getDashboard);
router.get("/users", getUsers);
router.put("/users/:id/toggle-block", toggleUserBlock);
router.delete("/users/:id", deleteUser);
router.get("/sellers", getSellers);
router.put("/sellers/:id/status", updateSellerStatus);
router.get("/revenue", getRevenueOverview);

module.exports = router;