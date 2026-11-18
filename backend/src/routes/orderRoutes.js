  const express = require('express');
  const { AppError } = require('../errors');

  // Kiểm tra :id trong đường dẫn
  function parseId(raw) {
    if (!/^\d+$/.test(raw)) {
      throw new AppError(400, 'BAD_ID', 'Mã đơn hàng không hợp lệ');
    }
    return Number(raw);
  }

  // Gói handler async để lỗi chuyển sang middleware xử lý lỗi
  const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

  // ---------- /api/orders (khách hàng + thao tác trên đơn) ----------
  function createOrderRouter(orderService) {
    const router = express.Router();

    // Tạo đơn hàng
    router.post('/', wrap(async (req, res) => {
      const order = await orderService.createOrder(req.body);
      res.status(201).json(order);
    }));

    // Tra cứu đơn theo số điện thoại
    router.get('/', wrap(async (req, res) => {
      res.json(await orderService.getOrdersByPhone(req.query.phone));
    }));

    // Danh sách đơn PENDING (thứ tự dựng lại hàng chờ)
    router.get('/pending', wrap(async (req, res) => {
      res.json(await orderService.getPendingOrders());
    }));

    // Admin: duyệt đơn tiếp theo (DEQ + cập nhật có điều kiện).
    // Phải đặt trước các route có :id.
    router.post('/process-next', wrap(async (req, res) => {
      const { orderId, skipped } = await orderService.processNextOrder();
      res.json({ message: 'Đã duyệt đơn hàng thành công', orderId, skipped });
    }));

    // Chi tiết đơn hàng
    router.get('/:id', wrap(async (req, res) => {
      res.json(await orderService.getOrderDetail(parseId(req.params.id)));
    }));

    // Hủy đơn (chỉ đơn PENDING). Đơn vẫn nằm trong Queue, bị bỏ qua khi tới lượt (lazy deletion)
    router.post('/:id/cancel', wrap(async (req, res) => {
      const order = await orderService.cancelOrder(parseId(req.params.id));
      res.json({ message: 'Đã hủy đơn hàng', orderId: order.orderId, status: order.status });
    }));

    // Hoàn thành đơn (chỉ đơn APPROVED)
    router.post('/:id/complete', wrap(async (req, res) => {
      const order = await orderService.completeOrder(parseId(req.params.id));
      res.json({ message: 'Đã hoàn thành đơn hàng', orderId: order.orderId, status: order.status });
    }));

    return router;
  }

  // ---------- /api/admin (Admin Dashboard) ----------
  function createAdminRouter(orderService) {
    const router = express.Router();

    // Toàn bộ đơn, mới nhất trước; lọc theo ?status=
    router.get('/orders', wrap(async (req, res) => {
      res.json(await orderService.getAllOrders(req.query.status));
    }));

    return router;
  }

  module.exports = { createOrderRouter, createAdminRouter };
