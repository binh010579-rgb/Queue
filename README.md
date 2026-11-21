# BeautyStore – Hàng chờ xử lý đơn hàng bằng Queue (FIFO)

Web bán mỹ phẩm. Khách đặt hàng, đơn vào **hàng chờ FIFO**; Admin bấm "xử lý đơn tiếp theo" thì duyệt đơn **cũ nhất trước**.

Hàng chờ do một chương trình **C++ riêng (Queue Engine)** giữ, cài bằng **danh sách liên kết đơn**. Backend Node.js nói chuyện với Engine qua stdin/stdout.

**Nguyên tắc chính:** Database (MySQL) là nguồn dữ liệu chính. Engine chỉ giữ thứ tự các mã đơn PENDING trong RAM. Mất Engine thì dựng lại hàng chờ từ Database.

## 1. Kiến trúc

```
Frontend (React + Vite)  ──HTTP──>  Backend (Node.js + Express)  ──stdin/stdout──>  Queue Engine (C++)
                                           │
                                           └── MySQL (orders, order_items, products)
```

| Luồng | Các bước |
|---|---|
| Đặt hàng | Kiểm tra dữ liệu → transaction lưu đơn `PENDING` → **commit** → gửi `ENQ <id>` |
| Xử lý đơn tiếp theo | Gửi `DEQ` → `UPDATE ... SET status='APPROVED' WHERE id=? AND status='PENDING'` → nếu `affectedRows = 0` (đơn đã hủy/đã xử lý) thì bỏ qua và `DEQ` tiếp; gặp `EMPTY` thì dừng |
| Hủy đơn | Chỉ đơn `PENDING`. Đơn vẫn nằm trong Queue và bị bỏ qua khi tới lượt (lazy deletion) |
| Engine chết | Backend khởi động lại Engine → `CLEAR` → `ENQ` lần lượt đơn PENDING theo `created_at`, rồi `id` tăng dần |

Trạng thái đơn: `PENDING` → `APPROVED` → `COMPLETED`, hoặc `PENDING` → `CANCELLED`.

## 2. Cấu trúc thư mục

```
.
├── frontend/                  React + TypeScript + Vite (trang khách + trang Admin)
│   └── src/ App.tsx, admin/Admin.tsx, api.ts
├── backend/                   Node.js + Express + MySQL
│   ├── src/
│   │   ├── server.js          khởi động server, nối Queue Engine
│   │   ├── app.js             Express app, CORS, gắn route, xử lý lỗi
│   │   ├── db.js              pool MySQL
│   │   ├── routes/            orderRoutes.js (đơn hàng + admin)
│   │   ├── services/          orderService.js (logic nghiệp vụ)
│   │   ├── repositories/      orderRepository.js (toàn bộ câu SQL)
│   │   ├── validators/        orderValidator.js
│   │   └── queue/             queueEngineClient.js (nói chuyện với Engine), noopQueue.js
│   ├── sql/                   01–08: tạo bảng, dữ liệu mẫu, truy vấn PENDING, chỉ mục, EXPLAIN
│   ├── ket_qua/               output thật khi chạy các script SQL
│   ├── tests/                 test validator, tích hợp, processNext, stress, fake engine
│   ├── benchmark/             bench-cost.js
│   └── docs/                  TV3_TrinhBay.md, api_mau.http
└── queue-engine/              C++17
    ├── src/                   queue_engine.h, queue_engine.cpp, json.hpp
    ├── tests/                 test_queue / test_enqueue / test_dequeue .cpp
    └── benchmark/             benchmark_queue.cpp, KET_QUA_BENCHMARK.md
```

## 3. Cài đặt và chạy

Cần: **g++ (C++17)**, **Node.js 18+**, **MySQL 8**.

> **Windows:** dùng PowerShell. Mở terminal ở thư mục gốc của project (thư mục chứa `frontend`, `backend`, `queue-engine`). Gõ `dir` để kiểm tra phải thấy 3 thư mục này. File zip tải từ GitHub hay bị lồng thư mục (`Queue-main\Queue-main\...`), nên có thể phải `cd` thêm một cấp.

### Bước 1 – Biên dịch Queue Engine

```bash
cd queue-engine
g++ -std=c++17 -O2 -Wall -Wextra -o queue_engine src/queue_engine.cpp
```

Không in gì là thành công. Windows sẽ tạo `queue_engine.exe`.

### Bước 2 – Tạo Database

**Cách A – MySQL Workbench (dễ nhất trên Windows):** mở Workbench, tạo hai database `beautystore` và `beautystore_test` (utf8mb4, `utf8mb4_unicode_ci`), chọn `beautystore`, rồi mở lần lượt `backend/sql/01_tao_bang.sql`, `02_du_lieu_kiem_thu.sql`, `07_tao_chi_muc.sql` và bấm ⚡ (Execute).

**Cách B – dòng lệnh** (`mysql` phải nằm trong PATH; nếu không, dùng đường dẫn đầy đủ tới `mysql.exe`):

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS beautystore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE DATABASE IF NOT EXISTS beautystore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
cd backend
```

Nạp từng file bằng chuyển hướng `<` (không dùng `-e "source a; source b"` vì lệnh `source` thứ hai bị gửi lên server như SQL và báo `ERROR 1064`):

```bash
# Linux / macOS / Git Bash
mysql -u root -p --default-character-set=utf8mb4 beautystore < sql/01_tao_bang.sql
mysql -u root -p --default-character-set=utf8mb4 beautystore < sql/02_du_lieu_kiem_thu.sql
mysql -u root -p --default-character-set=utf8mb4 beautystore < sql/07_tao_chi_muc.sql

# Windows PowerShell (toán tử < không dùng được trực tiếp, đi qua cmd)
cmd /c "mysql -u root -p --default-character-set=utf8mb4 beautystore < sql\01_tao_bang.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 beautystore < sql\02_du_lieu_kiem_thu.sql"
cmd /c "mysql -u root -p --default-character-set=utf8mb4 beautystore < sql\07_tao_chi_muc.sql"
```

Thứ tự: `01` (bảng) → `02` (dữ liệu mẫu: 9 sản phẩm, 16 đơn, 20 dòng đơn; **xóa dữ liệu cũ**) → `07` (chỉ mục, chạy sau khi đã có bảng). Cuối `07` in ra danh sách chỉ mục của bảng `orders`, đó không phải lỗi.

### Bước 3 – Chạy Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Mở `.env`, điền `DB_PASSWORD`. Biến `QUEUE_ENGINE_PATH` đã điền sẵn `../queue-engine/queue_engine` (Windows thêm `.exe`). Nếu để trống, đơn vẫn lưu `PENDING` nhưng **không vào hàng chờ**.

```bash
npm start                   # http://127.0.0.1:8080/api
```

Khi chạy đúng, terminal in ra hai dòng:

```
[queue] Đã kết nối Queue Engine và nạp lại đơn PENDING
BeautyStore API chạy tại http://127.0.0.1:8080/api
```

Nếu chỉ thấy dòng thứ hai kèm `[queue] Không khởi động được Queue Engine: ...` thì server vẫn chạy nhưng **hàng chờ không hoạt động** (xem mục "Lỗi thường gặp").

| Biến `.env` | Ý nghĩa |
|---|---|
| `PORT` | mặc định `8080` |
| `CORS_ORIGIN` | mặc định `*`; có thể đặt `http://localhost:5173` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | kết nối MySQL |
| `QUEUE_ENGINE_PATH` | đường dẫn file chạy Queue Engine |
| `TEST_DB_NAME` | database cho test tích hợp, **phải kết thúc bằng `_test`** |

### Bước 4 – Chạy Frontend

Mở **một cửa sổ terminal mới** (giữ nguyên terminal backend đang chạy):

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Frontend gọi API tại `http://127.0.0.1:8080/api` (đổi bằng biến `VITE_API_URL`). Trang Admin: `http://localhost:5173/#/admin`.

### Kịch bản demo nhanh (khoảng 3 phút)

1. Mở `http://localhost:5173`, đặt 2 đơn bằng cùng một số điện thoại (ví dụ `0901234567`).
2. Mở trang Admin: hai đơn mới ở trạng thái **Chờ xử lý**, hiện "Kế tiếp ▶" và "Lượt 2" (đúng thứ tự FIFO).
3. Bấm **Hủy đơn** ở đơn thứ nhất, rồi **Xử lý đơn tiếp theo**: hệ thống bỏ qua đơn đã hủy (thông báo "bỏ qua 1 đơn đã hủy") và duyệt đơn thứ hai.
4. Bấm **Hoàn thành** ở đơn vừa duyệt. Các thẻ thống kê (tổng số đơn, tổng giá trị, số đơn theo trạng thái) cập nhật theo.
5. Chọn **Ngày tạo** để lọc đơn theo ngày; chọn bộ lọc trạng thái để xem danh sách theo trạng thái.
6. Bấm **Xóa đơn** ở đơn Hoàn thành hoặc Đã hủy (có hộp xác nhận).
7. Trở lại trang khách, nhập số điện thoại để tra cứu lịch sử đơn.

### Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| `Cannot find path ... because it does not exist` (`cd`) | Sai thư mục hoặc gõ sai tên | Gõ `dir` xem tên thật; dùng phím Tab để tự điền tên |
| `src/queue_engine.cpp: No such file or directory` | Đang đứng sai thư mục khi chạy `g++` | `cd queue-engine` trước, rồi mới `g++ ...` |
| `'mysql' is not recognized` | Windows không tìm thấy `mysql.exe` | Dùng MySQL Workbench (Cách A), hoặc thêm thư mục `bin` của MySQL vào PATH, hoặc gọi bằng đường dẫn đầy đủ |
| `ERROR 1064 ... near 'source sql/...'` | Đặt nhiều `source` trong `-e "..."` | Nạp từng file bằng `<` như Bước 2 |
| `ERROR 1045 Access denied` | Sai mật khẩu MySQL | Nhập lại; `DB_PASSWORD` trong `.env` cũng phải đúng |
| `ECONNREFUSED` / `Can't connect to MySQL` | MySQL chưa chạy | Bật dịch vụ MySQL80 |
| `[queue] Không khởi động được Queue Engine` | Chưa biên dịch Engine hoặc `QUEUE_ENGINE_PATH` sai | Làm lại Bước 1; kiểm tra đường dẫn (Windows có `.exe`) |
| Frontend báo lỗi tải danh sách / tạo đơn | Backend chưa chạy hoặc khác cổng | Kiểm tra `http://127.0.0.1:8080/api/orders/pending` mở được; đồng bộ `PORT` và `VITE_API_URL` |
| `Chỉ xóa được đơn đã hủy hoặc đã hoàn thành` | Xóa đơn đang PENDING hoặc APPROVED | Hủy hoặc hoàn thành đơn trước |

## 4. API

Lỗi luôn có dạng `{ "message": "...", "code": "...", "details": ... }`.

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/orders` | Tạo đơn (`201`). Backend bỏ qua `name`, `price`, `total` do client gửi, tự lấy giá từ bảng `products` và tự tính tổng |
| GET | `/api/orders?phone=` | Lịch sử đơn theo SĐT, mới nhất trước |
| GET | `/api/orders/pending` | Đơn PENDING theo đúng thứ tự hàng chờ |
| GET | `/api/orders/:id` | Chi tiết đơn |
| POST | `/api/orders/process-next` | Admin: duyệt đơn tiếp theo |
| POST | `/api/orders/:id/cancel` | Hủy đơn (chỉ PENDING) |
| POST | `/api/orders/:id/complete` | Hoàn thành đơn (chỉ APPROVED) |
| DELETE | `/api/orders/:id` | Xóa đơn (chỉ đơn CANCELLED hoặc COMPLETED, ngược lại `409 ORDER_NOT_DELETABLE`) |
| GET | `/api/admin/orders?status=&from=&to=` | Admin: toàn bộ đơn, lọc theo trạng thái và ngày tạo (`from`, `to` dạng `YYYY-MM-DD`, gồm cả ngày `to`) |
| GET | `/api/admin/stats?from=&to=` | Admin: thống kê tổng số đơn, tổng giá trị, giá trị hợp lệ (không tính đơn hủy) và số đơn, giá trị theo từng trạng thái |

Mã lỗi thường gặp: `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `400 BAD_ID`, `404 ORDER_NOT_FOUND`, `409 INVALID_STATUS`, `409 ORDER_NOT_DELETABLE`, `422 PRODUCT_NOT_AVAILABLE`, `500 INTERNAL_ERROR`.

Ví dụ body tạo đơn:

```json
{
  "customerName": "Nguyễn Thị Lan",
  "phone": "0901234567",
  "address": "12 Lê Lợi, Q.1, TP.HCM",
  "items": [{ "productId": 4, "quantity": 1 }, { "productId": 5, "quantity": 2 }]
}
```

Request mẫu đầy đủ: `backend/docs/api_mau.http`.

## 5. Giao thức Backend – Queue Engine

Mỗi lệnh là một dòng, Engine trả đúng **một dòng** và flush ngay. Tên lệnh viết hoa đúng như bảng.

| Lệnh | Phản hồi | Ý nghĩa |
|---|---|---|
| `ENQ <id>` | `OK` / `ERR BAD_ID` | Thêm id vào cuối hàng |
| `DEQ` | `ID <id>` / `EMPTY` | Lấy và xóa id ở đầu hàng |
| `PEEK` | `ID <id>` / `EMPTY` | Xem id ở đầu hàng |
| `SIZE` | `SIZE <n>` | Số phần tử |
| `CLEAR` | `OK` | Xóa sạch hàng |
| Lệnh sai | `ERR BAD_COMMAND` | Engine bỏ qua và chạy tiếp |

Quy ước:
- Engine in `READY` khi sẵn sàng; Backend đợi dòng này rồi mới gửi lệnh.
- Id hợp lệ là số nguyên từ `1` đến `2147483647`. `007` được chấp nhận và lưu là `7`.
- Engine **không kiểm tra trùng id** (tốn O(n)), nên Backend không được `ENQ` trùng. Khi khôi phục luôn `CLEAR` trước.
- Khi stdin đóng, Engine giải phóng bộ nhớ và thoát với mã 0.

Thử nhanh: `printf 'ENQ 5\nENQ 7\nDEQ\nDEQ\nDEQ\n' | ./queue_engine` → `READY, OK, OK, ID 5, ID 7, EMPTY`.

### Cấu trúc dữ liệu

`Node` (`orderId`, `next`) → `Queue` (`front`, `rear`, `size`) → `QueueEngine` (nhận một dòng lệnh, trả một dòng phản hồi).

| Thao tác | Độ phức tạp |
|---|---|
| `enqueue`, `dequeue`, `peek`, `isEmpty`, `getSize` | O(1) |
| `clear` | O(n) |

Danh sách liên kết giữ sẵn `front` và `rear` nên thêm cuối và lấy đầu đều O(1); mảng thì lấy phần tử đầu phải dời cả mảng, tốn O(n).

## 6. Module tích hợp `queueEngineClient.js`

- Khởi động Engine **một lần** cùng server, giữ pipe, đợi `READY`. Không tạo tiến trình mới cho mỗi request vì sẽ mất hàng đợi và chậm hơn nhiều.
- **Tuần tự hóa lệnh:** mỗi lúc chỉ một lệnh chờ phản hồi, nên request đồng thời không làm lẫn phản hồi.
- **Kiểm tra id** trước khi gửi (`BAD_ID`), **kiểm tra từng phản hồi** theo đặc tả (`BAD_RESPONSE`), **hết thời gian chờ** (`TIMEOUT`: 3 giây mỗi lệnh, 5 giây cho `READY`).
- **Tự khôi phục** khi Engine thoát, lỗi pipe, `TIMEOUT` hoặc `BAD_RESPONSE`: khởi động lại → `CLEAR` → nạp lại đơn PENDING. Thử tối đa 3 lần, vẫn lỗi thì `RECOVERY_FAILED`. Lệnh đang chạy lúc Engine chết sẽ báo lỗi, đơn vẫn PENDING trong Database nên Admin chỉ cần bấm lại.
- **Chống xử lý trùng (2 lớp):** tuần tự hóa lệnh, và cập nhật có điều kiện `WHERE status='PENDING'` kiểm tra `affectedRows = 1`.

## 7. Database và chỉ mục (lọc, sắp xếp đơn PENDING)

Thứ tự dựng lại hàng chờ là `ORDER BY created_at ASC, id ASC`, tức đơn cũ trước và khi trùng `created_at` thì `id` nhỏ trước. Chỉ mục: `(status, created_at, id)` trong `sql/07_tao_chi_muc.sql`. Tra cứu theo SĐT dùng `idx_orders_phone_created`.

| File | Việc |
|---|---|
| `01_tao_bang.sql` | Tạo bảng và nạp 8 sản phẩm (chạy lại an toàn) |
| `02_du_lieu_kiem_thu.sql` | 16 đơn mẫu, **xóa dữ liệu cũ** |
| `03`, `04` | Truy vấn PENDING và kiểm tra thứ tự PASS/FAIL |
| `05_du_lieu_lon.sql` | 200.000 đơn, **xóa dữ liệu cũ** |
| `06`, `07`, `08` | EXPLAIN trước chỉ mục, tạo chỉ mục, EXPLAIN sau chỉ mục |

> ⚠️ `02` và `05` xóa sạch đơn hàng. Chỉ chạy trên `beautystore_test`.

Chạy phần kiểm thử và đo EXPLAIN:

```bash
cd backend
mysql -u root -p -t --default-character-set=utf8mb4 beautystore_test -e "source sql/01_tao_bang.sql; source sql/02_du_lieu_kiem_thu.sql; source sql/03_truy_van_pending.sql; source sql/04_kiem_tra_thu_tu.sql"
mysql -u root -p -t --default-character-set=utf8mb4 beautystore_test -e "source sql/05_du_lieu_lon.sql; source sql/06_explain_truoc_chi_muc.sql; source sql/07_tao_chi_muc.sql; source sql/08_explain_sau_chi_muc.sql"
```

Kết quả thật lưu trong `backend/ket_qua/`; nội dung trình bày trong `backend/docs/TV3_TrinhBay.md`.

## 8. Kiểm thử

```bash
# Queue Engine (trong queue-engine/)
g++ -std=c++17 -Wall -Wextra -o test_queue tests/test_queue.cpp && ./test_queue     # 80/80
g++ -std=c++17 -o test_enqueue tests/test_enqueue.cpp && ./test_enqueue             # 49/49
g++ -std=c++17 -o test_dequeue tests/test_dequeue.cpp && ./test_dequeue             # 89/89
# kiểm tra bộ nhớ: thêm -fsanitize=address,undefined -g (hoặc chạy Valgrind)

# Backend (trong backend/)
npm test                              # validator, processNext; test tích hợp cần MySQL
node --test tests/adminRoute.test.js  # route admin (chưa nằm trong npm test)
node tests/try-engine.js              # nạp, ENQ, duyệt, PEEK, ID sai, giết Engine rồi tự khôi phục
node tests/stress.js                  # 200 ENQ + 100 duyệt đồng thời, treo, phản hồi lạ, sai đường dẫn, ID sai
node benchmark/bench-cost.js          # Engine thường trực vs tiến trình mới mỗi request
```

`npm test` chạy test tích hợp chỉ khi `.env` có `TEST_DB_NAME` kết thúc bằng `_test` (test sẽ xóa và tạo lại bảng trong database đó). `tests/fake-engine.js` là Engine giả, cố tình treo hoặc trả lời sai, dùng cho test treo và phản hồi lạ.

## 9. Benchmark cấu trúc dữ liệu

Đo bằng `queue-engine/benchmark/benchmark_queue.cpp` (`n` lần enqueue rồi `n` lần dequeue):

| n | Linked List Queue | Array Queue |
|---|---|---|
| 1.000 | 0,0486 ms | 0,0177 ms |
| 10.000 | 0,9422 ms | 48,9983 ms |
| 100.000 | 7,3379 ms | 5582,4145 ms |

Danh sách liên kết nhanh hơn khoảng 760 lần ở `n = 100.000`. Mảng chỉ nhỉnh hơn ở `n` rất nhỏ nhờ CPU cache. Chi tiết trong `queue-engine/benchmark/KET_QUA_BENCHMARK.md`.

Chi phí gọi tiến trình (đo trên máy Linux của người soạn, **nên chạy lại trên máy nhóm trước khi nộp**): Engine thường trực khoảng 0,03 ms mỗi lệnh, còn tạo tiến trình mới mỗi request khoảng 7 ms, chênh khoảng 200 lần.

## 10. Phân công

| Thành viên | Phần việc |
|---|---|
| TV1 | Giao diện Khách hàng (Trang chủ, danh sách, tìm kiếm/lọc, chi tiết sản phẩm); kiểm thử Unit Test enqueue; Benchmark so sánh Linked List Queue với Array Queue. |
| TV2 | Giao diện thanh toán/đặt hàng; kiểm tra bộ nhớ Queue Engine (ASan/UBSan, Valgrind: 0 lỗi, 0 rò rỉ) |
| TV3 | API tạo/tra cứu đơn, lọc và sắp xếp đơn PENDING, chỉ mục, EXPLAIN, dữ liệu kiểm thử |
| TV4 | Queue Engine C++ (danh sách liên kết đơn) và giao thức lệnh |
| TV5 | Admin: xử lý đơn tiếp theo, hủy, hoàn thành, xóa đơn, danh sách đơn theo trạng thái, thống kê, tìm đơn theo ngày tạo |
| TV6 | Tích hợp Backend với Engine: kiểm soát kết quả, khôi phục, chống xử lý trùng |

## 11. Hạn chế đã biết

- Ngày tạo khi lọc do MySQL xác định theo múi giờ của server, nên đơn tạo sát nửa đêm có thể nằm ở ngày khác so với giờ trên máy người dùng.
- Chưa có bằng chứng chạy trọn luồng với MySQL thật (đặt hàng → duyệt → hủy/hoàn thành); cần chạy `npm test` với `TEST_DB_NAME` trước khi nộp.
- Số liệu benchmark chi phí tiến trình cần đo lại trên máy nhóm.
- Engine không kiểm tra trùng id; Backend chịu trách nhiệm không `ENQ` trùng.
