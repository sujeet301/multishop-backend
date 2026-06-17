const { Notification } = require("../models/Banner");

const createNotification = async (
  io,
  { recipient, type, title, message, link = "", data = {} }
) => {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      link,
      data,
    });

    // Emit real-time notification via Socket.IO
    if (io) {
      io.to(recipient.toString()).emit("notification", notification);
    }

    return notification;
  } catch (err) {
    console.error("Notification error:", err.message);
  }
};

module.exports = { createNotification };