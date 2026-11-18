// Hàng chờ tạm khi chưa kết nối Queue Engine
function createNoopQueue(logger = console) {
  return {
    async enqueue(orderId) {
      logger.info(`[queue] Chưa kết nối Queue Engine, bỏ qua ENQ ${orderId}`);
    },
  };
}

module.exports = { createNoopQueue };
