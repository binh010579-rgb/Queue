const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

// Kiểm tra route /api/admin/orders đã được gắn vào app (trước đây trả 404)
test('GET /api/admin/orders được gắn và truyền status cho service', async () => {
  let received;
  const orderService = {
    getAllOrders: async (status) => { received = status; return [{ orderId: 1 }]; },
  };
  const app = createApp({ orderService, logger: { error() {} } });
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/orders?status=PENDING`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), [{ orderId: 1 }]);
    assert.strictEqual(received, 'PENDING');
  } finally {
    server.close();
  }
});
