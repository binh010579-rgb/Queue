require('dotenv').config();

const path = require('path');
const { createPool } = require('./db');
const { createApp } = require('./app');
const { createOrderService } = require('./services/orderService');
const { createNoopQueue } = require('./queue/noopQueue');
const repo = require('./repositories/orderRepository');

// Khởi tạo Queue
function createQueue(pool) {
  const enginePath = process.env.QUEUE_ENGINE_PATH;
  if (!enginePath) return createNoopQueue();
  const { QueueEngineClient } = require('./queue/queueEngineClient');
  return new QueueEngineClient({
    enginePath: path.resolve(enginePath),
    getPendingIds: () => repo.getPendingOrderIds(pool),
  });
}

// Chạy server
async function main() {
  const pool = createPool();
  const queue = createQueue(pool);

  if (typeof queue.start === 'function') {
    try {
      await queue.start();
      console.log('[queue] Đã kết nối Queue Engine và nạp lại đơn PENDING');
    } catch (err) {
      console.error(`[queue] Không khởi động được Queue Engine: ${err.message}`);
    }
  }

  const orderService = createOrderService({ pool, queue });
  const app = createApp({ orderService, corsOrigin: process.env.CORS_ORIGIN || '*' });
  const port = Number(process.env.PORT || 8080);
  const server = app.listen(port, () => {
    console.log(`BeautyStore API chạy tại http://127.0.0.1:${port}/api`);
  });

  // Tắt server
  async function shutdown() {
    server.close();
    if (typeof queue.stop === 'function') await queue.stop().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
