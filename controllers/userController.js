// =============================================
// userController.js
// =============================================
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const { AppError } = require("../middleware/errorMiddleware");
const { cloudinary } = require("../config/cloudinary");

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.status(200).json({ success: true, data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone"];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f]) updates[f] = req.body[f]; });

  if (req.file) {
    // Delete old avatar
    if (req.user.avatar?.public_id) await cloudinary.uploader.destroy(req.user.avatar.public_id);
    updates.avatar = { public_id: req.file.filename, url: req.file.path };
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.status(200).json({ success: true, message: "Profile updated!", data: user });
});

const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) return next(new AppError("Current password is incorrect.", 401));
  user.password = newPassword;
  await user.save();
  res.status(200).json({ success: true, message: "Password changed successfully!" });
});

const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ success: true, message: "Address added!", data: user.addresses });
});

const updateAddress = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) return next(new AppError("Address not found.", 404));
  if (req.body.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  Object.assign(address, req.body);
  await user.save();
  res.status(200).json({ success: true, message: "Address updated!", data: user.addresses });
});

const deleteAddress = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $pull: { addresses: { _id: req.params.addressId } } });
  res.status(200).json({ success: true, message: "Address deleted." });
});

module.exports = { getProfile, updateProfile, changePassword, addAddress, updateAddress, deleteAddress };