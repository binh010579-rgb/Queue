# BeautyStore – Backend (phần việc TV3)

**API tạo đơn, tra cứu đơn, lọc và sắp xếp đơn PENDING để dựng lại hàng chờ.**
API theo đúng hợp đồng trong `frontend/src/api.ts` (gốc `http://127.0.0.1:8080/api`).

| Sản phẩm bàn giao (theo phân công) | Nằm ở đâu |
|---|---|
| API tạo đơn và truy vấn đơn PENDING | `src/` – `POST /api/orders`, `GET /api/orders?phone=`, `GET /api/orders/pending`, hàm `getPendingOrderIds()` |
| Script tạo chỉ mục | `sql/07_tao_chi_muc.sql` |
| Kết quả EXPLAIN trước/sau khi có chỉ mục | `ket_qua/06_explain_truoc_chi_muc.txt`, `ket_qua/08_explain_sau_chi_muc.txt` |
| Bộ dữ liệu kiểm thử (nhiều trạng thái, trùng `created_at`) | `sql/02_du_lieu_kiem_thu.sql` (16 đơn), `sql/05_du_lieu_lon.sql` (200.000 đơn) |
| Nội dung trình bày | `docs/TV3_TrinhBay.md` |

## Cấu trúc thư mục

```
backend/
├── sql/
│   ├── 01_tao_bang.sql              tạo bảng + nạp 8 sản phẩm của frontend
│   ├── 02_du_lieu_kiem_thu.sql      16 đơn mẫu (XÓA dữ liệu cũ)
│   ├── 03_truy_van_pending.sql      truy vấn lọc + sắp xếp
│   ├── 04_kiem_tra_thu_tu.sql       in PASS/FAIL thứ tự mong đợi
│   ├── 05_du_lieu_lon.sql           200.000 đơn để đo EXPLAIN (XÓA dữ liệu cũ)
│   ├── 06_explain_truoc_chi_muc.sql xóa chỉ mục rồi EXPLAIN
│   ├── 07_tao_chi_muc.sql           tạo chỉ mục (status, created_at, id)
│   └── 08_explain_sau_chi_muc.sql   EXPLAIN sau khi có chỉ mục
├── ket_qua/                         output thật khi chạy các script trên
├── src/
│   ├── server.js                    khởi động server, nối Queue Engine
│   ├── app.js                       Express app, CORS, xử lý lỗi
│   ├── db.js                        pool MySQL
│   ├── errors.js
│   ├── routes/orderRoutes.js
│   ├── services/orderService.js     tạo đơn (transaction), ENQ sau khi commit
│   ├── repositories/orderRepository.js  toàn bộ câu SQL
│   ├── validators/orderValidator.js
│   ├── queue/noopQueue.js           dùng khi chưa có Queue Engine
│   └── queueEngineClient.js         (của TV6, PR #4) nói chuyện với Engine qua stdin/stdout
├── tests/
│   ├── orderValidator.test.js       unit test, không cần Database
│   └── orders.integration.test.js   test với MySQL thật
└── docs/
    ├── TV3_TrinhBay.md              nội dung trình bày/bảo vệ
    └── api_mau.http                 request mẫu (VS Code REST Client)
```

## Chạy phần SQL

Bật MySQL 8 (service `MySQL80`), mở terminal tại thư mục `backend`.

Tạo database chính và database kiểm thử:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS beautystore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE DATABASE IF NOT EXISTS beautystore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

Database chính (để chạy web) chỉ cần tạo bảng và chỉ mục:

```bash
mysql -u root -p --default-character-set=utf8mb4 beautystore -e "source sql/01_tao_bang.sql; source sql/07_tao_chi_muc.sql"
```

Database kiểm thử: nạp 16 đơn mẫu, xem kết quả lọc/sắp xếp và kiểm tra thứ tự:

```bash
mysql -u root -p -t --default-character-set=utf8mb4 beautystore_test -e "source sql/01_tao_bang.sql; source sql/02_du_lieu_kiem_thu.sql; source sql/03_truy_van_pending.sql; source sql/04_kiem_tra_thu_tu.sql"
```

Đo EXPLAIN trước/sau chỉ mục trên 200.000 đơn:

```bash
mysql -u root -p -t --default-character-set=utf8mb4 beautystore_test -e "source sql/05_du_lieu_lon.sql; source sql/06_explain_truoc_chi_muc.sql; source sql/07_tao_chi_muc.sql; source sql/08_explain_sau_chi_muc.sql"
```

Cũng có thể mở từng file trong MySQL Workbench và bấm Execute.

> ⚠️ `02_...` và `05_...` **xóa sạch** dữ liệu đơn hàng trước khi nạp. Chỉ chạy trên `beautystore_test`.
> `01_tao_bang.sql` chạy lại nhiều lần vẫn an toàn: bảng đã có thì giữ nguyên, 8 sản phẩm được cập nhật lại tên và giá.

## Chạy API

Cần Node.js 18 trở lên.

```bash
npm install
```

```bash
copy .env.example .env
```

Mở `.env`, điền `DB_PASSWORD`, rồi:

```bash
npm start
```

Server chạy tại `http://127.0.0.1:8080/api` – đúng địa chỉ mặc định của frontend. Mở frontend (`cd frontend`, `npm run dev`) là đặt hàng được.

| Biến trong `.env` | Ý nghĩa |
|---|---|
| `PORT` | mặc định `8080` |
| `CORS_ORIGIN` | mặc định `*`; có thể đặt `http://localhost:5173` |
| `DB_*` | kết nối MySQL |
| `QUEUE_ENGINE_PATH` | đường dẫn file chạy Queue Engine (bản đọc lệnh qua stdin). Để trống thì đơn vẫn được lưu `PENDING` nhưng chưa ENQ |
| `TEST_DB_NAME` | database cho test tích hợp, phải kết thúc bằng `_test` |

```bash
npm test
```

`npm test` chạy unit test validator; test tích hợp chỉ chạy khi `.env` có `TEST_DB_NAME` kết thúc bằng `_test` (test sẽ xóa và tạo lại bảng trong database đó).

## Đặc tả API

Lỗi luôn có dạng `{ "message": "...", "code": "...", "details": ... }` – frontend đọc `message` để hiển thị.

### `POST /api/orders` – tạo đơn

Body (đúng như `createOrder()` trong `frontend/src/api.ts`):

```json
{
  "customerName": "Nguyễn Thị Lan",
  "phone": "0901234567",
  "address": "12 Lê Lợi, Q.1, TP.HCM",
  "items": [
    { "productId": 4, "name": "Kem dưỡng phục hồi Barrier Plus", "price": 465000, "quantity": 1 },
    { "productId": 5, "name": "Kem chống nắng Airy Shield SPF50+", "price": 390000, "quantity": 2 }
  ],
  "total": 1245000
}
```

`email` không bắt buộc. Backend **bỏ qua** `name`, `price`, `total` client gửi lên: tự lấy giá trong bảng `products`, tự tính tổng và luôn lưu `PENDING`.

Thành công `201`:

```json
{
  "orderId": 17,
  "orderCode": "BS-20261118-3FA9C1",
  "status": "PENDING",
  "customerName": "Nguyễn Thị Lan",
  "phone": "0901234567",
  "email": null,
  "address": "12 Lê Lợi, Q.1, TP.HCM",
  "total": 1245000,
  "createdAt": "2026-11-18T07:00:00.123Z",
  "items": [
    { "productId": 4, "name": "Kem dưỡng phục hồi Barrier Plus", "price": 465000, "quantity": 1 },
    { "productId": 5, "name": "Kem chống nắng Airy Shield SPF50+", "price": 390000, "quantity": 2 }
  ]
}
```

| Lỗi | Khi nào | `details` |
|---|---|---|
| `400 VALIDATION_ERROR` | thiếu/sai họ tên, SĐT, email, địa chỉ, sản phẩm, số lượng (1–99) | `[{ field, message }]` |
| `400 INVALID_JSON` | body không phải JSON | |
| `422 PRODUCT_NOT_AVAILABLE` | sản phẩm không tồn tại hoặc đã ngừng bán | `{ productIds: [...] }` |
| `500 INTERNAL_ERROR` | lỗi Database/hệ thống | |

Luồng xử lý: kiểm tra dữ liệu → transaction (lấy giá, lưu `orders` + `order_items`) → **commit** → `queue.enqueue(id)` (gửi `ENQ <id>`). Đơn lỗi hoặc rollback không bao giờ được ENQ. Nếu ENQ thất bại, đơn vẫn `PENDING` trong Database và sẽ được nạp lại khi khôi phục.

### `GET /api/orders?phone=0901234567` – lịch sử đơn của khách

Trả mảng, đơn mới nhất trước; không có đơn thì trả `[]`. SĐT sai → `400 VALIDATION_ERROR`.

```json
[
  { "orderId": 17, "orderCode": "...", "status": "PENDING", "createdAt": "2026-11-18T07:00:00.123Z", "total": 1245000, "items": [ ... ] }
]
```

### `GET /api/orders/pending` – đơn đang chờ, đúng thứ tự hàng chờ

```json
[ { "orderId": 9, "orderCode": "...", "customerName": "...", "total": 465000, "status": "PENDING", "createdAt": "..." } ]
```

### `GET /api/orders/:id` – chi tiết đơn (`404 ORDER_NOT_FOUND`, `400 BAD_ID`)

## Phối hợp với thành viên khác

**TV6 (tích hợp Queue Engine)** – `src/server.js` đã nối sẵn `QueueEngineClient` của TV6 (file `src/queueEngineClient.js` trong PR #4). Khi đặt `QUEUE_ENGINE_PATH`, server gọi `start()`: Engine khởi động, `CLEAR`, rồi ENQ lại các id do `getPendingOrderIds()` của TV3 trả về (đúng thứ tự `created_at, id`).

**TV4 (Queue Engine)** – `QueueEngineClient` cần file chạy đọc lệnh `ENQ/DEQ/PEEK/SIZE/CLEAR` qua stdin và in `READY` khi khởi động. Nhánh `main` hiện chỉ có `server.cpp` (HTTP), chưa có bản này.

**TV5 (Admin)** – frontend còn gọi `POST /orders/process-next`, `GET /admin/orders?status=`, `POST /orders/:id/cancel`, `POST /orders/:id/complete`. Các API này **không thuộc phần TV3**, cần TV5/TV6 thêm vào backend này. Cập nhật trạng thái nên có điều kiện: `UPDATE orders SET status = 'APPROVED' WHERE id = ? AND status = 'PENDING'` rồi kiểm tra `affectedRows === 1`.

**TV2 (thanh toán)** – trang đặt hàng gọi `POST /api/orders`; chỉ khi nhận `201` thì đơn mới được tạo và đưa vào hàng chờ.

## Đã kiểm tra những gì

- `sql/01`→`08` chạy trên MySQL 8.0.46; `04_kiem_tra_thu_tu.sql` cho **PASS** (thứ tự `9,2,4,5,8,7,11,13,14,16`); tổng tiền 16 đơn mẫu khớp với chi tiết đơn. Output thật lưu trong `ket_qua/`.
- `01_tao_bang.sql` chạy lại lần 2 không lỗi, giá sản phẩm được cập nhật lại đúng.
- Câu SQL tra cứu theo SĐT dùng chỉ mục `idx_orders_phone_created` (`type = ref`, không filesort).
- `tests/orderValidator.test.js`: 15/15 đạt.
- Luồng service với Database giả (commit rồi mới ENQ, rollback khi sản phẩm sai, thử lại khi trùng mã đơn, ENQ lỗi vẫn giữ đơn, tra cứu theo SĐT gom đúng sản phẩm): 7/7 đạt.
- **Chưa chạy**: server Express thật và `tests/orders.integration.test.js` (máy làm chưa cài Node.js/npm). Sau khi cài Node: `npm install` rồi `npm test`.
