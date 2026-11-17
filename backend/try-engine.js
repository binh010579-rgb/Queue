'use strict';

// Chạy thử độc lập, không cần Database / Express.
// Cách chạy (trong thư mục backend/):  node try-engine.js

const path = require('path');
const { QueueEngineClient } = require('./queueEngineClient');

const exe = process.platform === 'win32' ? 'queue_engine.exe' : 'queue_engine';
const enginePath = path.join(__dirname, '..', 'queue-engine', exe);

// Giả lập các đơn PENDING lấy từ Database (đã đúng thứ tự created_at, id)
const fakePending = [5, 6, 7];
const cancelled = new Set([5]); // giả lập đơn 5 đã bị hủy sau khi hàng chờ được tạo

const engine = new QueueEngineClient({
  enginePath,
  getPendingIds: async () => fakePending,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    await engine.start();
    console.log('1. size sau khi nạp         =', await engine.size()); // 3

    await engine.enqueue(8);
    console.log('2. size sau ENQ 8           =', await engine.size()); // 4

    // Đơn 5 đã hủy -> bị bỏ qua, duyệt đơn 6
    const approved = await engine.approveNext(async (id) => !cancelled.has(id));
    console.log('3. đơn được duyệt           =', approved); // 6

    console.log('4. peek                     =', await engine.peek()); // 7

    try {
      await engine.enqueue('abc');
    } catch (e) {
      console.log('5. ENQ id sai bị chặn       =', e.code); // BAD_ID
    }

    // Giả lập Engine bị tắt giữa chừng, rồi kiểm tra tự khôi phục
    console.log('6. giết Engine...');
    engine._proc.kill();
    await sleep(500);
    console.log('   size sau khôi phục       =', await engine.size()); // 3 (nạp lại từ fakePending)

    await engine.stop();
    console.log('Xong.');
  } catch (err) {
    console.error('LỖI:', err);
    await engine.stop();
    process.exit(1);
  }
})();
