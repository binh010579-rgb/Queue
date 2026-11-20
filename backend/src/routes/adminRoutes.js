const express = require('express');

function createAdminRouter(orderService) {
  const router = express.Router();

  // Xem đơn theo trạng thái và ngày tạo
  router.get('/orders', async (req, res, next) => {
    try {
      const orders = await orderService.listOrders(req.query);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  });

  // Thống kê đơn hàng
  router.get('/stats', async (req, res, next) => {
    try {
      const stats = await orderService.getOrderStats(req.query);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAdminRouter };
