require('dotenv').config();

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const mysql = require('mysql2/promise');

const { createPool } = require('../src/db');
const { createApp } = require('../src/app');
const { createOrderService } = require('../src/services/orderService');

// Cấu hình
const TEST_DB = process.env.TEST_DB_NAME || '';
const SKIP = /^[A-Za-z0-9_]+_test$/.test(TEST_DB)
  ? false
  : 'Cần đặt TEST_DB_NAME (tên kết thúc bằng _test) trong file .env';
const EXPECTED_PENDING = [9, 2, 4, 5, 8, 7, 11, 13, 14, 16];
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const silentLogger = { info() {}, warn() {}, error() {} };

function readSql(file) {
  return fs.readFileSync(path.join(__dirname, '..', 'sql', file), 'utf8');
}

describe('Tích hợp Database (TV3)', { skip: SKIP }, () => {
  let pool;
  let server;
  let baseUrl;
  const enqueued = [];

  // Nạp lại bảng và dữ liệu kiểm thử
  before(async () => {
    const admin = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.query(`USE \`${TEST_DB}\``);
    await admin.query('DROP TABLE IF EXISTS order_items, orders, products');
    await admin.query(readSql('01_tao_bang.sql'));
    await admin.query(readSql('02_du_lieu_kiem_thu.sql'));
    await admin.query(readSql('07_tao_chi_muc.sql'));
    await admin.end();

    pool = createPool({ database: TEST_DB });
    const queue = { async enqueue(id) { enqueued.push(id); } };
    const orderService = createOrderService({ pool, queue, logger: silentLogger });
    server = createApp({ orderService, logger: silentLogger }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) server.close();
    if (pool) await pool.end();
  });

  // Hàm hỗ trợ
  async function postOrder(body) {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  async function getJson(url) {
    const res = await fetch(`${baseUrl}${url}`);
    return { status: res.status, body: await res.json() };
  }

  async function countOrders() {
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    return rows[0].n;
  }

  const customer = {
    customerName: 'Khách Kiểm Thử',
    phone: '0909123456',
    email: 'test@example.com',
    address: '1 Nguyễn Huệ, Q.1, TP.HCM',
  };

  // Lọc và sắp xếp
  it('lọc PENDING và sắp xếp theo created_at, id', async () => {
    const service = createOrderService({ pool, queue: { async enqueue() {} } });
    assert.deepEqual(await service.getPendingOrderIdsForRebuild(), EXPECTED_PENDING);
  });

  it('GET /api/orders/pending trả đúng thứ tự và chỉ có PENDING', async () => {
    const res = await getJson('/api/orders/pending');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((o) => o.orderId), EXPECTED_PENDING);
    assert.ok(res.body.every((o) => o.status === 'PENDING'));
  });

  // Tạo đơn
  it('POST /api/orders nhận body của frontend, tính tiền từ Database và ENQ sau khi lưu', async () => {
    const queuedBefore = enqueued.length;
    const res = await postOrder({
      ...customer,
      items: [
        { productId: 4, name: 'Kem dưỡng', price: 1, quantity: 1 },
        { productId: 5, name: 'Kem chống nắng', price: 1, quantity: 2 },
      ],
      total: 1,
    });

    assert.equal(res.status, 201);
    const order = res.body;
    assert.equal(typeof order.orderId, 'number');
    assert.equal(order.status, 'PENDING');
    assert.match(order.createdAt, ISO_REGEX);
    assert.equal(order.total, 1245000);
    assert.match(order.orderCode, /^BS-\d{8}-[0-9A-F]{6}$/);
    assert.deepEqual(order.items.map((i) => [i.productId, i.price, i.quantity]), [[4, 465000, 1], [5, 390000, 2]]);
    assert.deepEqual(enqueued.slice(queuedBefore), [order.orderId]);

    const pending = await getJson('/api/orders/pending');
    assert.equal(pending.body[pending.body.length - 1].orderId, order.orderId);
  });

  it('sản phẩm không tồn tại hoặc ngừng bán: 422, không lưu, không ENQ', async () => {
    const ordersBefore = await countOrders();
    const queuedBefore = enqueued.length;
    const res = await postOrder({
      ...customer,
      items: [{ productId: 9, quantity: 1 }, { productId: 999, quantity: 1 }, { productId: 1, quantity: 1 }],
    });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'PRODUCT_NOT_AVAILABLE');
    assert.equal(typeof res.body.message, 'string');
    assert.deepEqual(res.body.details.productIds, [9, 999]);
    assert.equal(await countOrders(), ordersBefore);
    assert.equal(enqueued.length, queuedBefore);
  });

  it('dữ liệu sai: 400 VALIDATION_ERROR có message, không ENQ', async () => {
    const queuedBefore = enqueued.length;
    const res = await postOrder({ ...customer, phone: 'abc', items: [] });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.equal(res.body.message, 'Số điện thoại không hợp lệ');
    assert.equal(enqueued.length, queuedBefore);
  });

  it('JSON sai: 400 INVALID_JSON', async () => {
    const res = await postOrder('{"customerName": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_JSON');
  });

  // Queue Engine lỗi
  it('ENQ lỗi thì đơn vẫn được lưu PENDING để khôi phục sau', async () => {
    const brokenQueue = { async enqueue() { throw new Error('Engine stopped'); } };
    const service = createOrderService({ pool, queue: brokenQueue, logger: silentLogger });
    const order = await service.createOrder({ ...customer, items: [{ productId: 2, quantity: 1 }] });

    assert.equal(order.status, 'PENDING');
    const ids = await service.getPendingOrderIdsForRebuild();
    assert.equal(ids[ids.length - 1], order.orderId);
  });

  // Tra cứu theo số điện thoại
  it('GET /api/orders?phone= trả lịch sử đơn của khách', async () => {
    const old = await getJson('/api/orders?phone=0901000004');
    assert.equal(old.status, 200);
    assert.equal(old.body.length, 1);
    assert.equal(old.body[0].orderId, 4);
    assert.equal(old.body[0].total, 855000);
    assert.equal(old.body[0].items.length, 2);

    const mine = await getJson('/api/orders?phone=0909123456');
    assert.equal(mine.body.length, 2);
    assert.ok(mine.body[0].orderId > mine.body[1].orderId);

    const none = await getJson('/api/orders?phone=0988888888');
    assert.deepEqual(none.body, []);

    const bad = await getJson('/api/orders?phone=abc');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'VALIDATION_ERROR');
  });

  // CORS
  it('OPTIONS trả 204 kèm header CORS', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  // Chi tiết đơn
  it('GET /api/orders/:id', async () => {
    const ok = await getJson('/api/orders/4');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.total, 855000);
    assert.equal(ok.body.customerName, 'Phạm Ngọc Mai');

    const notFound = await getJson('/api/orders/99999');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.code, 'ORDER_NOT_FOUND');

    const badId = await getJson('/api/orders/abc');
    assert.equal(badId.status, 400);
  });

  // Xem theo trạng thái và tìm theo ngày tạo
  it('GET /api/admin/orders lọc theo trạng thái, mới nhất trước', async () => {
    const res = await getJson('/api/admin/orders?status=CANCELLED');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((o) => o.orderId), [10, 3]);
    assert.equal(res.body[0].customerName, 'Dương Mỹ Duyên');
    assert.equal(res.body[0].items.length, 2);
  });

  it('GET /api/admin/orders tìm theo ngày tạo', async () => {
    const oneDay = await getJson('/api/admin/orders?from=2026-11-11&to=2026-11-11');
    assert.deepEqual(oneDay.body.map((o) => o.orderId), [14, 13, 12, 11, 10]);

    const pendingInRange = await getJson('/api/admin/orders?status=PENDING&from=2026-11-10&to=2026-11-10');
    assert.deepEqual(pendingInRange.body.map((o) => o.orderId), [7, 8, 5, 4, 2, 9]);

    const page = await getJson('/api/admin/orders?from=2026-11-10&to=2026-11-12&limit=3&offset=1');
    assert.deepEqual(page.body.map((o) => o.orderId), [15, 14, 13]);

    const bad = await getJson('/api/admin/orders?from=2026-13-01');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'VALIDATION_ERROR');
  });

  // Thống kê
  it('GET /api/admin/stats thống kê số đơn và tổng giá trị', async () => {
    const res = await getJson('/api/admin/stats?from=2026-11-10&to=2026-11-12');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      totalOrders: 16,
      totalValue: 11013000,
      validValue: 9859000,
      byStatus: {
        PENDING: { count: 10, value: 6794000 },
        APPROVED: { count: 2, value: 1557000 },
        COMPLETED: { count: 2, value: 1508000 },
        CANCELLED: { count: 2, value: 1154000 },
      },
    });

    const oneDay = await getJson('/api/admin/stats?from=2026-11-10&to=2026-11-10');
    assert.equal(oneDay.body.totalOrders, 9);
    assert.equal(oneDay.body.byStatus.PENDING.count, 6);
  });

  // Xóa đơn
  it('DELETE /api/orders/:id chỉ xóa đơn đã hủy hoặc đã hoàn thành', async () => {
    const created = await postOrder({ ...customer, items: [{ productId: 1, quantity: 1 }] });
    const id = created.body.orderId;

    const pending = await fetch(`${baseUrl}/api/orders/${id}`, { method: 'DELETE' });
    assert.equal(pending.status, 409);
    assert.equal((await pending.json()).code, 'ORDER_NOT_DELETABLE');

    await pool.query("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [id]);
    const ok = await fetch(`${baseUrl}/api/orders/${id}`, { method: 'DELETE' });
    assert.equal(ok.status, 200);
    assert.equal((await getJson(`/api/orders/${id}`)).status, 404);
    const [items] = await pool.query('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?', [id]);
    assert.equal(items[0].n, 0);

    const notFound = await fetch(`${baseUrl}/api/orders/${id}`, { method: 'DELETE' });
    assert.equal(notFound.status, 404);
  });
});
