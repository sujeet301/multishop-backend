const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, changePassword, addAddress, updateAddress, deleteAddress } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { uploadAvatar } = require("../config/cloudinary");

router.use(protect);
router.get("/profile", getProfile);
router.put("/profile", uploadAvatar.single("avatar"), updateProfile);
router.put("/change-password", changePassword);
router.post("/addresses", addAddress);
router.put("/addresses/:addressId", updateAddress);
router.delete("/addresses/:addressId", deleteAddress);

module.exports = router;