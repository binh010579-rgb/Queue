// ============================================================================
// server.js - Backend API & Thuật toán xử lý đơn tiếp theo (BeautyStore)
// Phụ trách: TV5 (Admin Dashboard & Thuật toán Lazy Deletion)
//
// CÁCH CHẠY ĐỘC LẬP ĐỂ KIỂM THỬ:
//   1. Biên dịch C++: g++ -std=c++17 -Wall -Wextra -o queue_engine queue_engine.cpp
//   2. Cài thư viện : npm init -y && npm install express
//   3. Chạy server  : node server.js -> Mở http://localhost:3000/admin.html
//
// HƯỚNG DẪN TÍCH HỢP DATABASE CHO TV3:
//   - Tìm các khối đánh dấu "[TODO - TV3]" bên dưới để thay mảng mockOrders
//     bằng truy vấn MySQL (mysql2/promise).
//   - Khi TV3 tạo API đặt hàng mới (POST /api/orders), sau khi lưu đơn PENDING
//     vào MySQL thành công, gọi: await queueClient.enq(newOrderId);
// ============================================================================

const express = require('express');
const path = require('path');
const QueueEngineClient = require('./queueClient');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // Phục vụ trực tiếp tệp admin.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
// Tự động nhận diện tên tệp thực thi C++ trên Windows (.exe) hoặc Linux/macOS
const engineBinary = path.join(
  __dirname,
  process.platform === 'win32' ? 'queue_engine.exe' : 'queue_engine'
);
const queueClient = new QueueEngineClient(engineBinary);

// ============================================================================
// [TODO - TV3] DỮ LIỆU GIẢ LẬP TẠM THỜI (Thay bằng kết nối MySQL khi ghép nhóm)
// Cố tình đặt sẵn 2 đơn CANCELLED (#101, #102) đứng đầu Queue để kiểm thử
// thuật toán Lazy Deletion của TV5 ngay khi khởi động.
// ============================================================================
let mockOrders = [
  { id: 101, customer: 'Nguyễn Văn A', total: 250000, status: 'CANCELLED', created_at: '2026-11-18 08:00:00' },
  { id: 102, customer: 'Trần Thị B', total: 420000, status: 'CANCELLED', created_at: '2026-11-18 08:05:00' },
  { id: 103, customer: 'Lê Văn C', total: 180000, status: 'PENDING', created_at: '2026-11-18 08:10:00' },
  { id: 104, customer: 'Phạm Thị D', total: 560000, status: 'PENDING', created_at: '2026-11-18 08:15:00' },
];

/**
 * Khôi phục hàng chờ từ Database (chạy khi khởi động server hoặc khi C++ Engine sập)
 */
async function recoverQueueFromDB() {
  await queueClient.clear();

  // [TODO - TV3] Thay đoạn lọc mảng dưới đây bằng câu truy vấn có chỉ mục (status, created_at, id):
  // const [pendingOrders] = await db.query(
  //   "SELECT id FROM orders WHERE status = 'PENDING' ORDER BY created_at ASC, id ASC"
  // );
  const pendingOrders = mockOrders
    .filter((o) => o.status === 'PENDING')
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);

  for (const order of pendingOrders) {
    await queueClient.enq(order.id);
  }
  console.log(`[TV5-ADMIN] Đã nạp ${pendingOrders.length} đơn PENDING vào hàng chờ.`);
}

// ============================================================================
// API 1: Lấy toàn bộ danh sách đơn hàng hiển thị lên bảng Admin Dashboard
// ============================================================================
app.get('/api/admin/orders', async (req, res) => {
  // [TODO - TV3] Thay bằng: const [rows] = await db.query("SELECT * FROM orders ORDER BY id ASC");
  res.json(mockOrders);
});

// ============================================================================
// API 2: THUẬT TOÁN XỬ LÝ ĐƠN TIẾP THEO (TRỌNG TÂM CỦA TV5 - LAZY DELETION)
// - Nguyên lý: Queue C++ chỉ hỗ trợ ENQ/DEQ O(1), không xóa phần tử ở giữa.
//   Nếu khách hủy đơn khi đơn đã nằm trong Queue, đơn đó vẫn tồn tại trên RAM.
//   Do đó, khi duyệt đơn, hệ thống lặp gọi DEQ và đối chiếu trạng thái trong DB;
//   nếu đơn không còn PENDING thì bỏ qua (Lazy Deletion) và lấy đơn kế tiếp.
// - Độ phức tạp: O(k) với k là số đơn không hợp lệ liên tiếp bị bỏ qua.
// ============================================================================
app.post('/api/admin/orders/process-next', async (req, res) => {
  try {
    const skippedIds = []; // Ghi nhận các đơn đã hủy bị bỏ qua để hiển thị log minh họa

    while (true) {
      // Bước 1: Rút mã đơn ở đầu hàng chờ (front) từ C++ Engine -> O(1)
      const nextOrderId = await queueClient.deq();

      // Bước 2: Hàng chờ rỗng -> Dừng vòng lặp và thông báo cho Admin
      if (nextOrderId === null) {
        console.log('[TV5-ADMIN] Hàng chờ rỗng (EMPTY), dừng duyệt.');
        return res.json({
          success: false,
          message: 'Hàng chờ rỗng, không còn đơn PENDING nào cần xử lý.',
          skippedIds,
        });
      }

      // Bước 3: Cập nhật có điều kiện trong Database (chống 2 Admin duyệt trùng 1 đơn)
      // [TODO - TV3] Thay đoạn tìm mảng dưới đây bằng câu lệnh SQL nguyên tử:
      // const [result] = await db.query(
      //   "UPDATE orders SET status = 'APPROVED' WHERE id = ? AND status = 'PENDING'",
      //   [nextOrderId]
      // );
      // if (result.affectedRows === 1) { ... }
      const order = mockOrders.find((o) => o.id === nextOrderId && o.status === 'PENDING');

      if (order) {
        order.status = 'APPROVED';
        console.log(`[TV5-ADMIN] Duyệt thành công đơn #${order.id} (Bỏ qua ${skippedIds.length} đơn lỗi).`);
        return res.json({
          success: true,
          message: `Đã phê duyệt đơn hàng #${order.id} (${order.customer}).`,
          approvedOrder: order,
          skippedIds,
        });
      }

      // Bước 4: Đơn đã bị hủy (CANCELLED) hoặc không còn PENDING -> Bỏ qua và lặp tiếp
      console.log(`[TV5-ADMIN] Bỏ qua đơn #${nextOrderId} (không còn ở trạng thái PENDING).`);
      skippedIds.push(nextOrderId);
    }
  } catch (err) {
    console.error('[TV5-ADMIN] Lỗi khi xử lý đơn tiếp theo:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// API 3: Cập nhật trạng thái đơn hàng thủ công (Hoàn tất đơn hoặc giả lập hủy đơn)
// ============================================================================
app.patch('/api/admin/orders/:id/status', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  const validStatuses = ['PENDING', 'APPROVED', 'CANCELLED', 'COMPLETED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ.' });
  }

  // [TODO - TV3] Thay bằng: await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
  const order = mockOrders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ message: `Không tìm thấy đơn hàng #${id}` });

  order.status = status;
  console.log(`[TV5-ADMIN] Cập nhật trạng thái đơn #${id} -> ${status}`);
  res.json({ success: true, order });
});

// ============================================================================
// KHỞI ĐỘNG HỆ THỐNG
// ============================================================================
(async () => {
  try {
    await queueClient.start();

    // Khi chạy demo độc lập, nạp cả 4 đơn mẫu vào Queue để tái hiện tình huống
    // đơn #101, #102 bị khách hủy sau khi đã được đưa vào hàng chờ.
    // (Khi ghép DB thật với TV3, chỉ cần gọi: await recoverQueueFromDB();)
    await queueClient.clear();
    for (const o of mockOrders) {
      await queueClient.enq(o.id);
    }

    // Gắn hàm khôi phục tự động nếu tiến trình C++ gặp sự cố dừng đột ngột
    queueClient.onRecoverCallback = recoverQueueFromDB;

    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(`Admin Backend (TV5) đang chạy tại: http://localhost:${PORT}/admin.html`);
      console.log(`================================================================`);
    });
  } catch (err) {
    console.error('Khởi động thất bại:', err.message);
    process.exit(1);
  }
})(); 