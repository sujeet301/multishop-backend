const socketHandler = (io) => {
  io.on("connection", (socket) => {
    // User joins their own room for private notifications
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`🔌 User ${userId} joined socket room`);
    });

    // Seller joins their room
    socket.on("join_seller", (sellerId) => {
      socket.join(`seller_${sellerId}`);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected:", socket.id);
    });
  });
};

module.exports = socketHandler;