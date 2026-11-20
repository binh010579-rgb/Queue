const express = require('express');
const { AppError } = require('../errors');

function createOrderRouter(orderService) {
  const router = express.Router();

  // Tạo đơn hàng
  router.post('/', async (req, res, next) => {
    try {
      const order = await orderService.createOrder(req.body);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  });

  // Tra cứu đơn theo số điện thoại
  router.get('/', async (req, res, next) => {
    try {
      const orders = await orderService.getOrdersByPhone(req.query.phone);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  });

  // Danh sách đơn PENDING
  router.get('/pending', async (req, res, next) => {
    try {
      const orders = await orderService.getPendingOrders();
      res.json(orders);
    } catch (err) {
      next(err);
    }
  });

  // Chi tiết đơn hàng
  router.get('/:id', async (req, res, next) => {
    try {
      const order = await orderService.getOrderDetail(parseOrderId(req.params.id));
      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  // Xóa đơn hàng
  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await orderService.deleteOrder(parseOrderId(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Kiểm tra mã đơn trên đường dẫn
function parseOrderId(value) {
  if (!/^\d+$/.test(value)) {
    throw new AppError(400, 'BAD_ID', 'Mã đơn hàng không hợp lệ');
  }
  return Number(value);
}

module.exports = { createOrderRouter };
