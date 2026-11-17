# BÁO CÁO KIỂM TRA BỘ NHỚ QUEUE ENGINE (TV2)

Dự án BeautyStore – kiểm tra chéo mã nguồn của TV4 (`queue_engine.h`, `queue_engine.cpp`).

## 1. Mục tiêu

Xác nhận Queue Engine (danh sách liên kết đơn) thỏa mãn ba điều kiện:

1. Không rò rỉ bộ nhớ (mọi `new Node` đều có `delete` tương ứng).
2. Không truy cập vùng nhớ sai (use-after-free, tràn bộ đệm, con trỏ null).
3. Không có hành vi không xác định (undefined behavior, ví dụ tràn số nguyên).

## 2. Môi trường

| Mục | Giá trị |
| --- | --- |
| Hệ điều hành | Ubuntu 24.04 (Linux 6.x) |
| Trình biên dịch | g++ 13.3.0, chuẩn C++17 |
| Công cụ | AddressSanitizer (ASan) + LeakSanitizer + UndefinedBehaviorSanitizer (UBSan) |
| Valgrind | Không dùng; ASan đã bao gồm phát hiện rò rỉ và truy cập sai vùng nhớ |

> Nếu chạy lại trên Windows: dùng WSL hoặc Docker, vì MinGW thường không hỗ trợ ASan đầy đủ.

## 3. Lệnh chạy

Chạy trong thư mục `queue-engine/`:

```bash
# Bộ test của TV4 (80 test)
g++ -std=c++17 -Wall -Wextra -fsanitize=address,undefined -g -o test_queue tests/test_queue.cpp
./test_queue

# Bộ test dequeue của TV2 (89 test)
g++ -std=c++17 -Wall -Wextra -fsanitize=address,undefined -g -o test_dequeue tests/test_dequeue.cpp
./test_dequeue

# Chính Queue Engine, chạy với lệnh thật qua stdin
g++ -std=c++17 -Wall -Wextra -fsanitize=address,undefined -g -o queue_engine src/queue_engine.cpp
printf 'ENQ 5\nENQ 7\nDEQ\nDEQ\nDEQ\nENQ abc\nHELLO\n' | ./queue_engine
printf 'ENQ 1\nENQ 2\nENQ 3\n' | ./queue_engine    # để hàng còn 3 đơn rồi đóng stdin
```

## 4. Kết quả

| Chương trình | Kết quả | Lỗi ASan/UBSan | Rò rỉ |
| --- | --- | --- | --- |
| `test_queue` (TV4) | 80/80 test đạt | Không | Không |
| `test_dequeue` (TV2) | 89/89 test đạt | Không | Không |
| `queue_engine` với chuỗi lệnh đúng/sai | Đúng kết quả, thoát mã 0 | Không | Không |
| `queue_engine`, đóng stdin khi còn 3 đơn | Thoát mã 0 | Không | Không (destructor gọi `clear()`) |

`test_dequeue` gồm 7 nhóm: hàng rỗng; hàng 1 phần tử; nhiều phần tử (FIFO); dequeue xen kẽ enqueue; lấy hết rồi thêm lại (kiểm tra trực tiếp `front` và `rear` đều về `nullptr`); lệnh `DEQ` qua giao thức; hàng 100.000 phần tử.

**Kết luận:** không phát hiện lỗi bộ nhớ trong mã của TV4, nên không cần sửa.

## 5. Kiểm chứng rằng bộ test thật sự bắt được lỗi

Một bộ test chỉ đáng tin nếu nó báo lỗi khi mã sai. Nhóm cố ý làm hỏng hàm `dequeue` theo ba cách, mỗi lần chạy lại `test_dequeue` với ASan:

| Lỗi cố ý | Kết quả |
| --- | --- |
| Quên `rear = nullptr` khi lấy phần tử cuối | **Bị bắt:** 4 test FAIL (kiểm tra trực tiếp `rear`) |
| Quên `delete` node cũ | **Bị bắt:** LeakSanitizer báo rò rỉ 1.600.448 byte (100.028 lần cấp phát) |
| Bỏ kiểm tra hàng rỗng trong `dequeue` | **Bị bắt:** UBSan báo truy cập con trỏ null, ASan báo SEGV |

**Lưu ý quan trọng về lỗi thứ nhất:** khi ta thử chỉ dùng các hàm công khai (`enqueue`, `dequeue`, `peek`, `isEmpty`), lỗi quên `rear = nullptr` **không bị phát hiện**. Lý do: `enqueue` kiểm tra hàng rỗng bằng `front` rồi gán lại `rear`, nên `rear` treo không gây hậu quả quan sát được. Vì vậy `test_dequeue.cpp` mở `private` thành `public` (chỉ trong file test) để đọc trực tiếp `front` và `rear`. Mã nguồn của TV4 không bị thay đổi.

## 6. Giải thích kết quả (dùng khi bảo vệ)

- Mỗi `ENQ` cấp phát đúng một `Node` bằng `new`; mỗi `DEQ` giải phóng đúng một `Node` bằng `delete`. Số lần cấp phát và giải phóng khớp nhau khi lấy hết hàng.
- Khi Engine thoát mà hàng còn phần tử, destructor của `Queue` gọi `clear()` duyệt toàn bộ danh sách và `delete` từng node (O(n)), nên không rò rỉ.
- `CLEAR` cũng gọi `clear()`; sau đó `front`, `rear` về `nullptr` và `size` về 0.
- Lệnh sai (`ERR BAD_COMMAND`, `ERR BAD_ID`) được từ chối trước khi cấp phát node, nên không tạo node thừa.

## 7. Hạn chế

- ASan chỉ phát hiện lỗi ở các đường chạy mà test thực sự đi qua; vì vậy cần các bộ test ở mục 4.
- Chưa kiểm tra trường hợp nhiều tiến trình hoặc nhiều luồng truy cập cùng một Queue. Engine chạy một luồng và Backend (TV6) tuần tự hóa lệnh, nên không cần khóa trong Engine.
- Chưa chạy Valgrind.
