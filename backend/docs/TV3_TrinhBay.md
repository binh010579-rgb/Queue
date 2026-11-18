# TV3 – Lọc và sắp xếp đơn PENDING (dựng lại hàng chờ)

## 1. Bài toán

Queue của nhóm nằm trong RAM của tiến trình C++ Queue Engine. Khi server khởi động lại hoặc Engine bị dừng, Queue mất sạch. Database là nguồn dữ liệu chính, nên cần **lấy lại đúng các đơn đang chờ, theo đúng thứ tự đặt hàng**, để Backend gửi `CLEAR` rồi `ENQ` lần lượt từng id.

Phần của TV3 trả lời hai câu hỏi:

- **Lấy những đơn nào?** → chỉ đơn có `status = 'PENDING'`.
- **Theo thứ tự nào?** → `created_at` tăng dần, trùng thì `id` tăng dần.

```sql
SELECT id
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;
```

## 2. Tiêu chí lọc

| Trạng thái | Có vào hàng chờ? | Lý do |
|---|---|---|
| `PENDING` | Có | Đơn mới tạo, chưa được Admin xử lý |
| `APPROVED` | Không | Đã duyệt |
| `COMPLETED` | Không | Đã hoàn tất |
| `CANCELLED` | Không | Khách đã hủy |

Lọc và sắp xếp được làm **ngay trong câu SQL**, không tải toàn bộ đơn về Backend rồi lọc/sắp bằng JavaScript. Lý do: nếu bảng có n đơn mà chỉ m đơn PENDING, tải về Backend tốn O(n) dữ liệu qua mạng và bộ nhớ; còn Database có chỉ mục để chỉ đọc đúng m đơn, đã có thứ tự.

## 3. Vì sao sắp theo `created_at` rồi `id`

- `created_at` là **thời điểm khách đặt hàng** – đúng nghĩa FIFO của nghiệp vụ: đặt trước, xử lý trước. Cột lưu đến mili giây (`DATETIME(3)`) nên rất ít khi trùng.
- `id` dùng để **phân định khi trùng thời gian**. Nếu chỉ `ORDER BY created_at`, SQL **không bảo đảm** thứ tự giữa các dòng trùng nhau → hai lần khôi phục có thể cho hai hàng chờ khác nhau. Thêm `id` tạo thành thứ tự toàn phần, lần nào khôi phục cũng ra cùng một kết quả.
- Không dùng **chỉ `id`** vì thứ tự id không phải lúc nào cũng trùng thứ tự thời gian (ví dụ đơn nhập bù, đồng bộ trễ – đơn 9 trong bộ test).

## 4. Khi nào bước này chạy

| Tình huống | Cách đưa vào Queue | Có sắp xếp? |
|---|---|---|
| Khách vừa đặt đơn mới | Lưu Database → commit → `ENQ <id>` ngay | **Không** – đơn mới có `created_at` lớn nhất, thêm vào rear là đúng thứ tự, O(1) |
| Server khởi động / Engine bị dừng | `CLEAR` → truy vấn PENDING → `ENQ` từng id | **Có** – đây là lúc dùng truy vấn của TV3 |

Chi phí sắp xếp chỉ trả **một lần mỗi lần khôi phục**, không phải mỗi lần có đơn.

## 5. Vai trò của chỉ mục `(status, created_at, id)`

```sql
CREATE INDEX idx_orders_status_created_id ON orders (status, created_at, id);
```

Chỉ mục của MySQL (InnoDB) là cây **B+Tree**. Các mục trong chỉ mục được sắp theo thứ tự từ điển của bộ `(status, created_at, id)`:

```
(PENDING, 2026-11-10 07:30:00.000, 9)   ← điểm bắt đầu: tìm bằng cách đi từ gốc xuống, O(log n)
(PENDING, 2026-11-10 08:05:00.000, 2)
(PENDING, 2026-11-10 09:15:30.000, 4)   ← các đơn PENDING nằm liền nhau
(PENDING, 2026-11-10 09:15:30.000, 5)      và ĐÃ đúng thứ tự created_at, id
...                                      ← đọc tuần tự m mục, O(m)
(PENDING, 2026-11-12 09:00:00.000, 16)  ← gặp mục không còn PENDING thì dừng
(APPROVED, ..., ...) ...
(COMPLETED, ..., ...) ...
(CANCELLED, ..., ...) ...
```

`status` là kiểu ENUM nên MySQL sắp theo thứ tự khai báo (`PENDING` = 1, `APPROVED` = 2, `COMPLETED` = 3, `CANCELLED` = 4), vì vậy khối PENDING đứng đầu chỉ mục.

- Tầng lá của B+Tree là **danh sách liên kết** giữa các trang, nên đọc m mục liên tiếp chỉ là duyệt tuần tự – không cần sắp xếp thêm.
- Cột so sánh bằng (`status`) phải đứng **đầu** chỉ mục, các cột dùng để sắp xếp đứng sau. Nếu đặt `(created_at, status)` thì các đơn PENDING bị rải khắp chỉ mục, không lấy được một đoạn liền nhau.
- Chỉ mục chứa sẵn `id`, nên truy vấn `SELECT id` không cần đọc bảng gốc – MySQL gọi là **covering index** (`Using index`).

## 6. Kết quả EXPLAIN (200.000 đơn, 4.000 đơn PENDING)

Chạy `sql/05` → `sql/08`, output đầy đủ trong `ket_qua/`.

| | Trước khi có chỉ mục | Sau khi có chỉ mục |
|---|---|---|
| `type` | `ALL` – quét toàn bảng | `ref` – tra chỉ mục với `status = 'PENDING'` |
| `key` | `NULL` | `idx_orders_status_created_id` |
| `rows` (ước lượng phải đọc) | 198.971 | 4.000 |
| `Extra` | `Using where; Using filesort` | `Using index` |
| Thời gian thực (`EXPLAIN ANALYZE`) | ≈ 107 ms | ≈ 1,73 ms |

Cách đọc:

- **Trước**: đọc cả 200.000 dòng, lọc ra 4.000 dòng (`Using where`), rồi sắp xếp riêng (`Using filesort`).
- **Sau**: nhảy thẳng đến đoạn PENDING trong chỉ mục, đọc đúng 4.000 mục đã có thứ tự; không còn `filesort`, không đọc bảng gốc. Nhanh hơn khoảng 60 lần trên máy thử (con số thời gian thay đổi theo máy, nhưng `type`/`rows`/`Extra` thì ổn định).

Kế hoạch thực thi thật (trích `EXPLAIN ANALYZE`):

```
Trước:
-> Sort: orders.created_at, orders.id            (actual rows=4000)
    -> Filter: (orders.status = 'PENDING')        (actual rows=4000)
        -> Table scan on orders                   (actual rows=200000)

Sau:
-> Covering index lookup on orders using idx_orders_status_created_id (status='PENDING')  (actual rows=4000)
```

## 7. Độ phức tạp

n = tổng số đơn, m = số đơn PENDING.

| Cách làm | Lọc | Sắp xếp | Tổng |
|---|---|---|---|
| Không có chỉ mục | quét toàn bảng O(n) | sắp m đơn O(m log m) | **O(n + m log m)** |
| Có chỉ mục `(status, created_at, id)` | tìm điểm bắt đầu O(log n) | đã có thứ tự, đọc m mục O(m) | **O(log n + m)** |

Đánh đổi: chỉ mục tốn thêm bộ nhớ O(n), và mỗi lần thêm đơn hoặc đổi `status` tốn thêm O(log n) để cập nhật chỉ mục. Đổi lại, khôi phục hàng chờ chỉ phụ thuộc số đơn đang chờ m, không phụ thuộc tổng số đơn lịch sử n (vốn tăng mãi theo thời gian).

Tạo một đơn có k dòng sản phẩm: tra giá k sản phẩm theo khóa chính O(k log n), chèn đơn + k dòng chi tiết O(k log n), rồi `ENQ` O(1).

## 8. Bộ dữ liệu kiểm thử (`sql/02_du_lieu_kiem_thu.sql`)

| id | created_at | status | Kiểm tra điều gì |
|---|---|---|---|
| 1 | 10/11 08:00:00.000 | COMPLETED | bị loại |
| 2 | 10/11 08:05:00.000 | PENDING | |
| 3 | 10/11 08:05:00.000 | CANCELLED | trùng giờ với đơn 2 nhưng đã hủy → loại |
| 4 | 10/11 09:15:30.000 | PENDING | **trùng `created_at`** với 5 → id nhỏ đứng trước |
| 5 | 10/11 09:15:30.000 | PENDING | |
| 6 | 10/11 09:15:30.000 | APPROVED | trùng giờ nhưng đã duyệt → loại |
| 7 | 10/11 10:00:00.**250** | PENDING | id nhỏ hơn 8 nhưng đặt **sau 150 ms** → đứng sau 8 |
| 8 | 10/11 10:00:00.**100** | PENDING | |
| 9 | 10/11 **07:30**:00.000 | PENDING | id lớn nhưng đặt **sớm nhất** → đứng đầu (sắp theo thời gian, không theo id) |
| 10 | 11/11 08:00:00.000 | CANCELLED | bị loại |
| 11 | 11/11 08:00:00.000 | PENDING | |
| 12 | 11/11 14:20:00.000 | COMPLETED | bị loại |
| 13 | 11/11 14:20:00.000 | PENDING | trùng giờ với 14 |
| 14 | 11/11 14:20:00.000 | PENDING | |
| 15 | 12/11 09:00:00.000 | APPROVED | bị loại |
| 16 | 12/11 09:00:00.000 | PENDING | |

**Kết quả mong đợi**: `9 → 2 → 4 → 5 → 8 → 7 → 11 → 13 → 14 → 16` (10/16 đơn).
**Kết quả thực tế**: `sql/04_kiem_tra_thu_tu.sql` in ra **PASS**.

Ngoài ra `sql/05_du_lieu_lon.sql` sinh 200.000 đơn (2% PENDING, 3% APPROVED, 10% CANCELLED, 85% COMPLETED; cứ 2 đơn liên tiếp trùng `created_at`) để đo EXPLAIN.

## 9. Phần của TV3 liên kết với các thành viên khác

```
TV2 (thanh toán) ──POST /api/orders──► TV3: kiểm tra, lưu PENDING, commit
                                              │
                                              ▼
                                   TV6: queue.enqueue(id) ──ENQ <id>──► TV4: Queue Engine (rear)

Khởi động / Engine dừng:
TV6: CLEAR ──► TV3: getPendingOrderIdsForRebuild()  (WHERE + ORDER BY + chỉ mục)
           ──► TV6: ENQ từng id theo đúng thứ tự ──► TV4

TV5 (Admin): DEQ ──► UPDATE ... WHERE id = ? AND status = 'PENDING' (dùng cột status do TV3 thiết kế)
```

- **ENQ chỉ sau khi commit**: nếu ENQ trước mà transaction bị rollback, Queue sẽ chứa id của đơn không tồn tại.
- **ENQ lỗi không làm mất đơn**: đơn đã nằm trong Database với `PENDING`, lần khôi phục kế tiếp sẽ nạp lại.
- **Tổng tiền tính ở Backend** từ giá trong bảng `products`, không tin số tiền client gửi lên.

## 10. Kịch bản demo khi bảo vệ (≈ 3 phút)

1. Chạy `02` → giới thiệu 16 đơn, chỉ ra các ca trùng giờ.
2. Chạy `03` → thứ tự `9, 2, 4, 5, 8, 7, 11, 13, 14, 16`; giải thích vì sao 9 đứng đầu, 4 trước 5, 8 trước 7.
3. Chạy `04` → PASS.
4. Chạy `05`, `06` → chỉ vào `type = ALL`, `Using filesort`, ~200.000 rows.
5. Chạy `07`, `08` → `type = ref`, `key = idx_orders_status_created_id`, `Using index`, 4.000 rows.
6. (Nếu server chạy) gửi request "Tạo đơn hợp lệ" trong `docs/api_mau.http` → gọi `GET /api/orders/pending` → đơn mới nằm cuối.

## 11. Câu hỏi bảo vệ dự kiến

**Vì sao không tải hết đơn về Backend rồi sắp xếp bằng JavaScript?**
Tốn O(n) truyền dữ liệu và bộ nhớ cho cả những đơn đã xong. Database có chỉ mục nên chỉ đọc m đơn PENDING, đã đúng thứ tự.

**Vì sao chỉ mục là `(status, created_at, id)` mà không phải `(created_at, status)`?**
Cột so sánh bằng phải đứng đầu để các đơn PENDING nằm liền nhau trong chỉ mục; hai cột sau trùng với `ORDER BY` nên không phải sắp xếp thêm.

**InnoDB tự thêm khóa chính vào cuối chỉ mục phụ, vậy ghi `id` vào chỉ mục có thừa không?**
Về kết quả thì `(status, created_at)` cũng đã ngầm sắp theo `id`. Nhóm vẫn ghi rõ `id` để thể hiện đúng ý đồ thứ tự `created_at, id` và không phụ thuộc vào chi tiết cài đặt của InnoDB.

**Chỉ mục có nhược điểm gì?**
Tốn thêm bộ nhớ và mỗi lần thêm đơn/đổi trạng thái tốn thêm O(log n) để cập nhật chỉ mục. Chấp nhận được vì đổi lại khôi phục chỉ còn O(log n + m).

**Hai đơn có cùng `created_at` đến từng mili giây thì sao?**
`id` phân định: id nhỏ (được tạo trước) đứng trước. Thứ tự luôn xác định.

**Hai khách đặt gần như cùng lúc, thứ tự ENQ có thể khác thứ tự khi khôi phục không?**
Có thể lệch nhau vài mili giây vì ENQ đi theo thứ tự commit. Cả hai đơn đều được xử lý, không mất đơn; khi khôi phục luôn dùng một thứ tự thống nhất `created_at, id`.

**Vì sao đơn mới không cần sắp xếp?**
Đơn mới có `created_at` lớn nhất nên thêm vào rear vẫn giữ đúng thứ tự – O(1). Sắp xếp chỉ cần khi dựng lại cả hàng chờ.

**Nếu Queue Engine đang tắt khi khách đặt hàng?**
API vẫn lưu đơn `PENDING` và trả `201`; ENQ lỗi chỉ được ghi log. TV6 phát hiện Engine dừng, khởi động lại, `CLEAR` rồi nạp lại từ truy vấn của TV3 – đơn đó có mặt trong hàng chờ.

**Vì sao không dùng `ORDER BY ... LIMIT 1` mỗi lần Admin bấm xử lý?**
Mục tiêu môn học là tự cài đặt Queue FIFO; Queue lấy đơn kế tiếp O(1) trong bộ nhớ. Truy vấn của TV3 chỉ dùng khi cần dựng lại Queue từ Database.
