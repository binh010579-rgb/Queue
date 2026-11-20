const express = require('express');
const { AppError } = require('./errors');
const { createOrderRouter } = require('./routes/orderRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');

// Trả lỗi dạng JSON
function sendError(res, status, code, message, details) {
  const body = { message, code };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}

function createApp({ orderService, logger = console, corsOrigin = '*' }) {
  const app = express();

  // CORS cho frontend
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', corsOrigin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // Middleware
  app.use(express.json({ limit: '100kb' }));

  // Routes
  app.use('/api/orders', createOrderRouter(orderService));
  app.use('/api/admin', createAdminRouter(orderService));

  // Không tìm thấy route
  app.use((req, res) => sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy đường dẫn'));

  // Xử lý lỗi
  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, 'INVALID_JSON', 'Body không phải JSON hợp lệ');
    }
    if (err.type === 'entity.too.large') {
      return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn');
    }
    logger.error(err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Lỗi hệ thống');
  });

  return app;
}

module.exports = { createApp };
