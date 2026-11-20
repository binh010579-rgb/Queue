// Kiểm thử thuật toán "xử lý đơn tiếp theo" (TV5) - không cần Database và Engine thật.
// Dùng đúng hàm approveNext của QueueEngineClient (TV6) và processNextOrder của orderService.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { QueueEngineClient, EngineError } = require('../src/queueEngineClient');
const { createOrderService } = require('../src/services/orderService');

const silentLogger = { info() {}, warn() {}, error() {} };

// Queue giả: giữ mảng id, dùng approveNext thật của TV6
function fakeQueue(ids) {
  return {
    items: [...ids],
    async dequeue() {
      return this.items.length ? this.items.shift() : null;
    },
    approveNext: QueueEngineClient.prototype.approveNext,
  };
}

// Database giả: chỉ hiểu câu UPDATE có điều kiện (status = ?) của updateStatusIf
function fakePool(statusById) {
  return {
    statusById,
    async execute(sql, [to, id, from]) {
      const ok = this.statusById.get(id) === from;
      if (ok) this.statusById.set(id, to);
      return [{ affectedRows: ok ? 1 : 0 }];
    },
  };
}

function setup(queueIds, statuses) {
  const queue = fakeQueue(queueIds);
  const pool = fakePool(new Map(Object.entries(statuses).map(([k, v]) => [Number(k), v])));
  const service = createOrderService({ pool, queue, logger: silentLogger });
  return { queue, pool, service };
}

describe('Xử lý đơn tiếp theo (TV5)', () => {
  it('đơn hợp lệ: duyệt đơn đầu hàng, skipped = 0', async () => {
    const { service, pool, queue } = setup([1, 2, 3], { 1: 'PENDING', 2: 'PENDING', 3: 'PENDING' });
    const result = await service.processNextOrder();
    assert.deepEqual(result, { orderId: 1, skipped: 0 });
    assert.equal(pool.statusById.get(1), 'APPROVED');
    assert.equal(pool.statusById.get(2), 'PENDING');
    assert.deepEqual(queue.items, [2, 3]);
  });

  it('giữ đúng thứ tự FIFO qua nhiều lần duyệt', async () => {
    const { service } = setup([5, 6, 7], { 5: 'PENDING', 6: 'PENDING', 7: 'PENDING' });
    const order = [];
    for (let i = 0; i < 3; i += 1) order.push((await service.processNextOrder()).orderId);
    assert.deepEqual(order, [5, 6, 7]);
  });

  it('đơn đã hủy nằm đầu hàng: bỏ qua rồi duyệt đơn kế tiếp, skipped = 1', async () => {
    const { service, pool } = setup([1, 2], { 1: 'CANCELLED', 2: 'PENDING' });
    const result = await service.processNextOrder();
    assert.deepEqual(result, { orderId: 2, skipped: 1 });
    assert.equal(pool.statusById.get(1), 'CANCELLED');
    assert.equal(pool.statusById.get(2), 'APPROVED');
  });

  it('nhiều đơn hủy liên tiếp: bỏ qua hết, skipped = 3', async () => {
    const { service } = setup([1, 2, 3, 4], { 1: 'CANCELLED', 2: 'CANCELLED', 3: 'APPROVED', 4: 'PENDING' });
    const result = await service.processNextOrder();
    assert.deepEqual(result, { orderId: 4, skipped: 3 });
  });

  it('không bao giờ duyệt lại đơn đã APPROVED hoặc COMPLETED', async () => {
    const { service, pool } = setup([1, 2], { 1: 'APPROVED', 2: 'COMPLETED' });
    await assert.rejects(() => service.processNextOrder(), { status: 409, code: 'QUEUE_EMPTY' });
    assert.equal(pool.statusById.get(1), 'APPROVED');
    assert.equal(pool.statusById.get(2), 'COMPLETED');
  });

  it('Queue rỗng: trả 409 QUEUE_EMPTY', async () => {
    const { service } = setup([], {});
    await assert.rejects(() => service.processNextOrder(), { status: 409, code: 'QUEUE_EMPTY' });
  });

  it('toàn đơn không hợp lệ: Queue cạn thì trả 409, skipped nằm trong details', async () => {
    const { service } = setup([1, 2], { 1: 'CANCELLED', 2: 'CANCELLED' });
    await assert.rejects(
      () => service.processNextOrder(),
      (err) => err.status === 409 && err.code === 'QUEUE_EMPTY' && err.details.skipped === 2,
    );
  });

  it('hai Admin bấm cùng lúc: mỗi đơn chỉ được duyệt một lần', async () => {
    const { service, pool } = setup([1, 2, 3], { 1: 'PENDING', 2: 'PENDING', 3: 'PENDING' });
    const results = await Promise.all([service.processNextOrder(), service.processNextOrder()]);
    const ids = results.map((r) => r.orderId).sort();
    assert.deepEqual(ids, [1, 2]);
    assert.equal(pool.statusById.get(3), 'PENDING');
  });

  it('chưa kết nối Queue Engine (noopQueue): trả 503 QUEUE_UNAVAILABLE', async () => {
    const service = createOrderService({
      pool: fakePool(new Map()),
      queue: { async enqueue() {} },
      logger: silentLogger,
    });
    await assert.rejects(() => service.processNextOrder(), { status: 503, code: 'QUEUE_UNAVAILABLE' });
  });

  it('Engine gặp sự cố: trả 503 QUEUE_ENGINE_ERROR', async () => {
    const queue = {
      async approveNext() {
        throw new EngineError('ENGINE_EXIT', 'Engine đã dừng');
      },
    };
    const service = createOrderService({ pool: fakePool(new Map()), queue, logger: silentLogger });
    await assert.rejects(() => service.processNextOrder(), { status: 503, code: 'QUEUE_ENGINE_ERROR' });
  });
});
