# BeautyStore – Backend (phần việc TV3)

**API tạo đơn, tra cứu đơn, lọc và sắp xếp đơn PENDING để dựng lại hàng chờ.**
API theo đúng hợp đồng trong `frontend/src/api.ts` (gốc `http://127.0.0.1:8080/api`).

| Sản phẩm bàn giao (theo phân công) | Nằm ở đâu |
|---|---|
| API tạo đơn và truy vấn đơn PENDING | `src/` – `POST /api/orders`, `GET /api/orders?phone=`, `GET /api/orders/pending`, hàm `getPendingOrderIds()` |
| Xem đơn theo trạng thái, tìm theo ngày tạo, thống kê, xóa đơn | `GET /api/admin/orders`, `GET /api/admin/stats`, `DELETE /api/orders/:id`; câu SQL mẫu `sql/09_thong_ke_va_tim_kiem.sql` |
| Script tạo chỉ mục | `sql/07_tao_chi_muc.sql` |
| Kết quả EXPLAIN trước/sau khi có chỉ mục | `ket_qua/06_explain_truoc_chi_muc.txt`, `ket_qua/08_explain_sau_chi_muc.txt`, `ket_qua/10_explain_tim_kiem.txt` |
| Bộ dữ liệu kiểm thử (nhiều trạng thái, trùng `created_at`) | `sql/02_du_lieu_kiem_thu.sql` (16 đơn), `sql/05_du_lieu_lon.sql` (200.000 đơn) |
| Nội dung trình bày | `docs/TV3_TrinhBay.md` |

## Cấu trúc thư mục

```
backend/
├── sql/
│   ├── 01_tao_bang.sql              tạo bảng + nạp 8 sản phẩm của frontend
│   ├── 02_du_lieu_kiem_thu.sql      16 đơn mẫu (XÓA đơn hàng cũ, chỉ chạy trên *_test)
│   ├── 03_truy_van_pending.sql      truy vấn lọc + sắp xếp
│   ├── 04_kiem_tra_thu_tu.sql       in PASS/FAIL thứ tự mong đợi
│   ├── 05_du_lieu_lon.sql           200.000 đơn để đo EXPLAIN (XÓA đơn hàng cũ, chỉ chạy trên *_test)
│   ├── 06_explain_truoc_chi_muc.sql xóa chỉ mục rồi EXPLAIN
│   ├── 07_tao_chi_muc.sql           tạo chỉ mục (status, created_at, id)
│   ├── 08_explain_sau_chi_muc.sql   EXPLAIN sau khi có chỉ mục
│   ├── 09_thong_ke_va_tim_kiem.sql  thống kê, tìm theo ngày tạo, xem theo trạng thái
│   └── 10_explain_tim_kiem.sql      EXPLAIN các câu ở 09 trên 200.000 đơn
├── ket_qua/                         output thật khi chạy các script trên
├── src/
│   ├── server.js                    khởi động server, nối Queue Engine
│   ├── app.js                       Express app, CORS, xử lý lỗi
│   ├── db.js                        pool MySQL
│   ├── errors.js
│   ├── routes/orderRoutes.js        /api/orders (tạo, tra cứu, chi tiết, xóa)
│   ├── routes/adminRoutes.js        /api/admin (xem theo trạng thái/ngày, thống kê)
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

Các lệnh `source` dưới đây gõ **mỗi lệnh một dòng** tại dấu nhắc `mysql>`. Không gộp nhiều `source` vào một dòng hay vào `-e "..."`: client `mysql` chỉ nhận lệnh `source` ở đầu dòng, các `source` phía sau sẽ bị báo lỗi cú pháp.

Database chính (để chạy web) chỉ cần tạo bảng và chỉ mục:

```bash
mysql -u root -p --default-character-set=utf8mb4 beautystore
```

```sql
source sql/01_tao_bang.sql
source sql/07_tao_chi_muc.sql
exit
```

Database kiểm thử: nạp 16 đơn mẫu, xem kết quả lọc/sắp xếp, kiểm tra thứ tự, thống kê và tìm theo ngày, rồi đo EXPLAIN trước/sau chỉ mục trên 200.000 đơn:

```bash
mysql -u root -p --default-character-set=utf8mb4 beautystore_test
```

```sql
source sql/01_tao_bang.sql
source sql/02_du_lieu_kiem_thu.sql
source sql/03_truy_van_pending.sql
source sql/04_kiem_tra_thu_tu.sql
source sql/09_thong_ke_va_tim_kiem.sql
source sql/05_du_lieu_lon.sql
source sql/06_explain_truoc_chi_muc.sql
source sql/07_tao_chi_muc.sql
source sql/08_explain_sau_chi_muc.sql
source sql/10_explain_tim_kiem.sql
exit
```

Cũng có thể mở từng file trong MySQL Workbench và bấm Execute.

> ⚠️ **`02_...` và `05_...` xóa toàn bộ đơn hàng** (bảng `orders` và `order_items`) trước khi nạp. `02_...` còn đưa tên và giá của sản phẩm 1–9 về giá trị mẫu (các sản phẩm khác giữ nguyên).
> Hai file này chỉ chạy được trên database có tên kết thúc bằng `_test`. Chạy nhầm trên `beautystore` sẽ báo lỗi `Check constraint 'chi_chay_tren_database_test' is violated` và dừng **trước khi xóa** bất cứ thứ gì.
> Trong MySQL Workbench, giữ bật nút *Stop script execution on errors* (mặc định đã bật) để script dừng khi gặp lỗi này.
>
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

### `GET /api/admin/orders` – xem đơn theo trạng thái, tìm theo ngày tạo

| Tham số (đều không bắt buộc) | Ý nghĩa |
|---|---|
| `status` | `PENDING`, `APPROVED`, `COMPLETED`, `CANCELLED` (không phân biệt hoa thường). Bỏ trống = mọi trạng thái |
| `from`, `to` | ngày tạo dạng `YYYY-MM-DD`, lấy **cả ngày** `to`. Chỉ có `from` = từ ngày đó trở đi; chỉ có `to` = đến hết ngày đó |
| `limit`, `offset` | phân trang, `limit` từ 1 đến 1000. Không có `limit` thì trả hết |

Trả mảng đơn **mới nhất trước** (`ORDER BY created_at DESC, id DESC`), mỗi đơn có đủ thông tin khách và sản phẩm – đúng kiểu `AdminOrder` của frontend:

```json
[
  {
    "orderId": 10, "orderCode": "BS-20261111-000010", "status": "CANCELLED",
    "customerName": "Dương Mỹ Duyên", "phone": "0901000010", "email": null, "address": "Q.4, TP.HCM",
    "total": 634000, "createdAt": "2026-11-11T01:00:00.000Z",
    "items": [
      { "productId": 1, "name": "Sữa rửa mặt dịu nhẹ Pure Clean", "price": 289000, "quantity": 1 },
      { "productId": 2, "name": "Nước cân bằng Rose Balance", "price": 345000, "quantity": 1 }
    ]
  }
]
```

Ví dụ: `?status=CANCELLED`, `?from=2026-11-11&to=2026-11-11`, `?status=PENDING&from=2026-11-10&to=2026-11-10`, `?from=2026-11-10&to=2026-11-12&limit=20&offset=0`.
Tham số sai (trạng thái lạ, ngày không có thật như `2026-02-30`, `from` sau `to`, `limit` ngoài 1–1000, có `offset` mà thiếu `limit`) → `400 VALIDATION_ERROR`.

### `GET /api/admin/stats` – thống kê đơn hàng

Nhận `status`, `from`, `to` giống trên. Ví dụ `?from=2026-11-10&to=2026-11-12` trên 16 đơn mẫu:

```json
{
  "totalOrders": 16,
  "totalValue": 11013000,
  "validValue": 9859000,
  "byStatus": {
    "PENDING":   { "count": 10, "value": 6794000 },
    "APPROVED":  { "count": 2,  "value": 1557000 },
    "COMPLETED": { "count": 2,  "value": 1508000 },
    "CANCELLED": { "count": 2,  "value": 1154000 }
  }
}
```

`validValue` = tổng tiền không tính đơn đã hủy. `byStatus` luôn đủ 4 trạng thái (không có đơn thì `0`).

### `DELETE /api/orders/:id` – xóa đơn

Chỉ xóa được đơn **đã hủy (`CANCELLED`) hoặc đã hoàn thành (`COMPLETED`)**; sản phẩm của đơn (`order_items`) bị xóa theo nhờ `ON DELETE CASCADE`. Đơn `PENDING`/`APPROVED` muốn bỏ thì phải **hủy** trước (API hủy của TV5/TV6).

| Kết quả | Khi nào |
|---|---|
| `200 { "orderId": 10, "message": "Đã xóa đơn hàng" }` | xóa thành công |
| `409 ORDER_NOT_DELETABLE`, `details: { status }` | đơn đang `PENDING` hoặc `APPROVED` |
| `404 ORDER_NOT_FOUND` | không có đơn (hoặc đã xóa rồi) |
| `400 BAD_ID` | id không phải số |

Câu xóa có điều kiện trong cùng một lệnh: `DELETE FROM orders WHERE id = ? AND status IN ('CANCELLED', 'COMPLETED')`, nên không bao giờ xóa nhầm đơn đang chờ dù có người khác đổi trạng thái cùng lúc.

### Độ phức tạp (n = số đơn, k = số đơn trả về)

| Thao tác | Chỉ mục dùng | Độ phức tạp |
|---|---|---|
| Xem theo trạng thái | `(status, created_at, id)`, quét ngược | O(log n + k) |
| Tìm theo ngày tạo | `(status, created_at, id)`, 4 khoảng (mỗi trạng thái một khoảng) | O(log n + k log k) |
| Thống kê | quét cả chỉ mục, `GROUP BY status` | O(n) |
| Xóa đơn | khóa chính `id` | O(log n) + số sản phẩm của đơn |

Số đo thật trên 200.000 đơn nằm ở `ket_qua/10_explain_tim_kiem.txt`.

## Phối hợp với thành viên khác

**TV6 (tích hợp Queue Engine)** – `src/server.js` đã nối sẵn `QueueEngineClient` của TV6 (file `src/queueEngineClient.js` trong PR #4). Khi đặt `QUEUE_ENGINE_PATH`, server gọi `start()`: Engine khởi động, `CLEAR`, rồi ENQ lại các id do `getPendingOrderIds()` của TV3 trả về (đúng thứ tự `created_at, id`).

**TV4 (Queue Engine)** – `QueueEngineClient` cần file chạy đọc lệnh `ENQ/DEQ/PEEK/SIZE/CLEAR` qua stdin và in `READY` khi khởi động. Nhánh `main` hiện chỉ có `server.cpp` (HTTP), chưa có bản này.

**TV5 (Admin)** – TV3 đã làm phần truy vấn dữ liệu cho trang Admin:
- `GET /api/admin/orders` (đúng hàm `getAllOrders()` frontend đang gọi) có thêm `status`, `from`, `to`, `limit`, `offset`. Trang Admin có thể gửi luôn khoảng ngày và trạng thái lên server thay vì tải hết rồi lọc ở trình duyệt.
- `GET /api/admin/stats` trả sẵn số đơn và tổng tiền theo trạng thái, không cần tải mọi đơn mỗi 5 giây để tự cộng.
- `DELETE /api/orders/:id` – cần TV5 thêm nút **Xóa** cho đơn đã hủy/hoàn thành và hiển thị `message` khi gặp `409`.

Còn **không thuộc phần TV3**: `POST /orders/process-next`, `POST /orders/:id/cancel`, `POST /orders/:id/complete` (TV5/TV6 thêm vào backend này). Cập nhật trạng thái nên có điều kiện: `UPDATE orders SET status = 'APPROVED' WHERE id = ? AND status = 'PENDING'` rồi kiểm tra `affectedRows === 1`. Vì đơn đã hủy có thể bị xóa, `process-next` gặp id không còn trong Database hoặc không còn `PENDING` thì bỏ qua và DEQ tiếp (lazy deletion).

**TV2 (thanh toán)** – trang đặt hàng gọi `POST /api/orders`; chỉ khi nhận `201` thì đơn mới được tạo và đưa vào hàng chờ.

## Đã kiểm tra những gì

- `sql/01`→`08` chạy trên MySQL 8.0.46; `04_kiem_tra_thu_tu.sql` cho **PASS** (thứ tự `9,2,4,5,8,7,11,13,14,16`); tổng tiền 16 đơn mẫu khớp với chi tiết đơn. Output thật lưu trong `ket_qua/`.
- `01_tao_bang.sql` chạy lại lần 2 không lỗi, giá sản phẩm được cập nhật lại đúng.
- Câu SQL tra cứu theo SĐT dùng chỉ mục `idx_orders_phone_created` (`type = ref`, không filesort).
- `sql/09` trên 16 đơn mẫu: thống kê 16 đơn / 11.013.000đ / hợp lệ 9.859.000đ (khớp từng trạng thái); tìm ngày 11/11 ra 5 đơn `14,13,12,11,10`; xem `CANCELLED` ra `10,3`.
- Các câu SQL do API sinh ra (lọc trạng thái, ngày, phân trang, thống kê, xóa có điều kiện) đã chạy thử trên MySQL: xóa đơn `PENDING` → 0 dòng, xóa đơn `CANCELLED` → 1 dòng và `order_items` của đơn bị xóa theo.
- `sql/10` trên 200.000 đơn: tìm theo ngày dùng `range` trên `idx_orders_status_created_id` (1.152 dòng, ≈4,7 ms); xem theo trạng thái dùng `ref` + `Backward index scan`, không filesort; thống kê quét chỉ mục O(n).
- `tests/orderValidator.test.js`: 20/20 đạt (thêm 5 test cho bộ lọc trạng thái/ngày/phân trang).
- Luồng service với Database giả (commit rồi mới ENQ, rollback khi sản phẩm sai, thử lại khi trùng mã đơn, ENQ lỗi vẫn giữ đơn, tra cứu theo SĐT gom đúng sản phẩm, xem/thống kê/xóa đơn): 10/10 đạt.
- **Chưa chạy**: server Express thật và `tests/orders.integration.test.js` (máy làm chưa cài Node.js/npm). Sau khi cài Node: `npm install` rồi `npm test`.
