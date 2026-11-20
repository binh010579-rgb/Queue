# Báo cáo TV6 – Tích hợp Backend (Node.js) với Queue Engine (C++)

Dự án BeautyStore. Phần việc: kết nối Backend với Queue Engine của TV4, kiểm soát kết quả, khôi phục khi Engine dừng, chống xử lý trùng.

## 1. Bài toán

Hệ thống có hai chương trình chạy riêng: Backend Node.js (web server) và Queue Engine C++ (giữ hàng đợi FIFO các mã đơn PENDING trong RAM). Hai bên không tự nói chuyện được, TV6 viết module làm cầu nối.

Hai nguyên tắc thiết kế:

- **Database là nguồn dữ liệu chính.** Engine chỉ giữ thứ tự xử lý, nên mất Engine vẫn dựng lại được hàng đợi từ Database.
- **Engine chạy thường trực**, vì mỗi tiến trình mới có hàng rỗng (mất toàn bộ đơn đang chờ) và việc tạo tiến trình tốn kém.

## 2. Luồng dữ liệu

```
Khách đặt hàng
   -> Backend lưu đơn PENDING vào Database
   -> Backend gửi  ENQ <id>  cho Engine (qua stdin)   -> Engine trả  OK

Admin bấm "xử lý đơn tiếp theo"
   -> Backend gửi  DEQ  cho Engine                    -> Engine trả  ID <id>  hoặc  EMPTY
   -> Backend cập nhật Database:
        UPDATE orders SET status='APPROVED' WHERE id=? AND status='PENDING'
   -> affectedRows = 1  : duyệt thành công
      affectedRows = 0  : đơn đã hủy/đã xử lý -> bỏ qua, DEQ tiếp
   -> gặp EMPTY         : không còn đơn
```

Giao thức lệnh (do TV4 và TV6 chốt chung, chi tiết trong `queue-engine/README.md`):

| Lệnh | Phản hồi |
|---|---|
| `ENQ <id>` | `OK` hoặc `ERR BAD_ID` |
| `DEQ` | `ID <id>` hoặc `EMPTY` |
| `PEEK` | `ID <id>` hoặc `EMPTY` |
| `SIZE` | `SIZE <n>` |
| `CLEAR` | `OK` |
| lệnh sai | `ERR BAD_COMMAND` |

## 3. Module `src/queueEngineClient.js`

- Khởi động Engine **một lần** cùng server, giữ pipe stdin/stdout, **đợi dòng `READY`** rồi mới gửi lệnh.
- **Tuần tự hóa lệnh:** các lệnh xếp thành chuỗi Promise, mỗi lúc chỉ một lệnh chờ phản hồi, nên các request đồng thời không làm lẫn phản hồi.
- API: `enqueue(id)`, `dequeue()`, `peek()`, `size()`, `clear()`, `approveNext(tryApprove)`, `start()`, `stop()`.
- `approveNext` lặp `DEQ` rồi gọi `tryApprove(id)` (cập nhật có điều kiện) cho đến khi duyệt được một đơn hoặc gặp `EMPTY`.

## 4. Xác thực kết quả

- **Kiểm tra id trước khi gửi:** phải là số nguyên từ 1 đến 2147483647, sai thì báo `BAD_ID` ngay ở Node, không gửi cho Engine.
- **Kiểm tra từng phản hồi** bằng biểu thức chính quy theo đặc tả (ví dụ `DEQ` chỉ chấp nhận `ID <số dương>` hoặc `EMPTY`). Phản hồi lạ báo `BAD_RESPONSE`.
- **Hết thời gian chờ** (mặc định 3 giây mỗi lệnh, 5 giây cho dòng `READY`) báo `TIMEOUT`.
- Dòng Engine tự in ngoài lệnh cũng coi là lệch pha và xử lý như sự cố.

## 5. Khôi phục khi Engine dừng

Sự cố gồm: Engine thoát, lỗi pipe, `TIMEOUT`, `BAD_RESPONSE`.

1. Module tắt tiến trình hỏng và khởi động Engine mới.
2. Gửi `CLEAR`.
3. Lấy danh sách đơn PENDING từ Database (hàm `getPendingIds` do TV3 cung cấp, đã sắp xếp `created_at` rồi `id` tăng dần).
4. Gửi `ENQ` lần lượt từng đơn.

Nếu thất bại thì thử lại tối đa 3 lần (nghỉ 0,5 giây, 1 giây, 1,5 giây), vẫn thất bại thì báo `RECOVERY_FAILED`. Các lệnh đến trong lúc khôi phục sẽ chờ đến khi xong.

**Lệnh đang chạy lúc Engine chết:** báo lỗi cho người gọi. Vì đơn vẫn PENDING trong Database nên không mất, lần khôi phục sẽ nạp lại; Admin chỉ cần bấm lại.

## 6. Hạn chế xử lý trùng (hai lớp)

1. **Tuần tự hóa lệnh:** hai Admin bấm cùng lúc sẽ nhận hai id khác nhau từ `DEQ`.
2. **Cập nhật có điều kiện** `WHERE status='PENDING'`, chỉ tính thành công khi `affectedRows = 1`. Đơn đã hủy hoặc đã duyệt sẽ bị bỏ qua.

Engine không kiểm tra trùng id (vì tốn O(n)), nên Backend không được `ENQ` trùng; khi khôi phục luôn `CLEAR` trước rồi mới nạp lại.

## 7. Độ phức tạp và chi phí giao tiếp

| Thao tác | Độ phức tạp |
|---|---|
| `ENQ`, `DEQ`, `PEEK`, `SIZE` | O(1) |
| `CLEAR` | O(n) |
| Khôi phục n đơn | O(n) lệnh `ENQ` |

Cần phân biệt **độ phức tạp thuật toán** với **thời gian gọi tiến trình**: mỗi lệnh vẫn có chi phí giao tiếp qua pipe, và việc tạo tiến trình mới cho mỗi request còn tốn hơn nhiều.

Số liệu đo bằng `backend/benchmark/bench-cost.js` (thường trực: 5.000 cặp ENQ+DEQ; tiến trình mới: 200 request, mỗi request một tiến trình):

| Cách làm | Thời gian | Ghi chú |
|---|---|---|
| Engine thường trực, qua pipe | khoảng 0,03 ms mỗi lệnh | đo 3 lần: 0,023 đến 0,041 ms |
| Gọi tiến trình mới mỗi request | khoảng 7 ms mỗi request | đo 3 lần: 6,0 đến 7,8 ms |
| Chênh lệch | khoảng 200 lần | đo 3 lần: 190 đến 258 lần; chưa kể việc mất hàng đợi |

> Các số trên đo trên máy kiểm thử Linux của người soạn. Trên máy khác (nhất là Windows, tạo tiến trình chậm hơn) số sẽ khác. **Nên chạy lại `node benchmark/bench-cost.js` trên máy của nhóm và thay số liệu ở bảng này trước khi nộp.**

## 8. Test tích hợp

| Tình huống | File | Kết quả mong đợi |
|---|---|---|
| Thành công (nạp đơn, ENQ, duyệt đơn, PEEK) | `tests/try-engine.js` | size 3, rồi 4, duyệt đơn 6, PEEK 7 |
| Queue rỗng | `tests/stress.js` (A) | `dequeue()` trả `null` |
| ID sai (0, âm, chữ, số thập phân, quá lớn) | `tests/stress.js` (E) | `BAD_ID`, không gửi sang Engine |
| Engine bị tắt giữa chừng | `tests/try-engine.js` bước 6 | tự khôi phục, size về 3 |
| Hai Admin xử lý đồng thời | `tests/stress.js` (A) | 200 ENQ và 100 lần duyệt đồng thời, không trùng, đúng FIFO, bỏ qua đơn đã hủy |
| Engine bị treo | `tests/stress.js` (B) | `TIMEOUT` rồi tự khôi phục |
| Engine trả phản hồi lạ | `tests/stress.js` (C) | `BAD_RESPONSE` rồi tự khôi phục |
| Sai đường dẫn Engine | `tests/stress.js` (D) | `RECOVERY_FAILED` |

`tests/fake-engine.js` là Engine giả (cố tình treo hoặc trả lời sai) dùng cho test B và C, vì Engine thật của TV4 chạy đúng nên không tự gây ra hai lỗi đó.

**Kết quả đã chạy:** với Engine thật của TV4 biên dịch bằng g++, `tests/try-engine.js` đạt đủ 6 bước và `tests/stress.js` đạt cả 5 nhóm A đến E, trên Windows (g++ 12.1.0, Node.js v26) và trên Linux.

## 9. Cách chạy

Yêu cầu: Node.js 14 trở lên, g++ (hoặc Visual Studio).

```
# 1. Biên dịch Engine (trong thư mục queue-engine/)
g++ -std=c++17 -Wall -Wextra -o queue_engine src/queue_engine.cpp

# 2. Chạy thử và test (trong thư mục backend/)
node tests/try-engine.js
node tests/stress.js
node benchmark/bench-cost.js
```

Cấu trúc thư mục phần TV6:

```
backend/
├── src/
│   └── queueEngineClient.js
├── tests/
│   ├── try-engine.js
│   ├── stress.js
│   └── fake-engine.js
├── benchmark/
│   └── bench-cost.js
└── BAO_CAO_TICH_HOP.md
```

Cách dùng trong Express:

```js
const { QueueEngineClient } = require('./src/queueEngineClient');
const engine = new QueueEngineClient({
  enginePath: './queue-engine/queue_engine',   // Windows: queue_engine.exe
  getPendingIds: async () => { /* TV3: danh sách id PENDING đã sắp xếp */ },
});
await engine.start();                 // một lần khi server khởi động
await engine.enqueue(orderId);        // sau khi lưu đơn PENDING
await engine.approveNext(async (id) => { /* UPDATE ... WHERE status='PENDING'; return affectedRows === 1 */ });
```

## 10. Giới hạn hiện tại

- Test chạy với Engine thật của TV4 và Engine giả; **chưa chạy với Database và Express thật của nhóm**, vì module chưa gắn vào `server.js`.
- Việc gắn vào API phụ thuộc phần của TV3 (`getPendingIds`, truy vấn PENDING) và TV5 (API xử lý đơn).

## 11. Liên kết với các thành viên khác

- **TV4:** giao thức lệnh và Engine C++.
- **TV3:** dữ liệu đơn hàng, danh sách PENDING theo đúng thứ tự.
- **TV5:** API xử lý đơn trên Admin gọi `approveNext`.
- **TV2:** chỉ đơn tạo thành công mới được `enqueue`.
