const express = require("express");
const router = express.Router();
const { getNotifications, markAsRead } = require("../controllers/miscControllers");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);
router.get("/", getNotifications);
router.put("/read/:id", markAsRead);

module.exports = router;