# Báo cáo Tổng hợp Công việc – Thành viên 1 (TV1)

**Vai trò:** Kiểm thử Unit Test (`enqueue`), Đo hiệu năng (Benchmark) cấu trúc dữ liệu Queue và Phát triển Giao diện Khách hàng (Customer UI).

---

## 1. Kiểm thử Unit Test thao tác `enqueue` (C++)

### 1.1. Môi trường & Mã nguồn
- **Trình biên dịch:** `g++ -std=c++17`
- **Mã nguồn liên quan:** `queue-engine/src/queue_engine.h`, `queue-engine/tests/test_queue.cpp`, `queue-engine/tests/test_enqueue.cpp`

### 1.2. Kịch bản kiểm thử & Kết quả
Bổ sung hàm `testEnqueueChiTiet()` tích hợp trực tiếp vào bộ kiểm thử gốc của nhóm (80 test cases) với 9 kịch bản kiểm tra chuyên sâu cho thao tác thêm phần tử vào cuối hàng đợi (`enqueue`):
- **Hàng đợi rỗng $\rightarrow$ 1 phần tử:** Kiểm tra trạng thái `isEmpty() == false`, kích thước `getSize() == 1`, và con trỏ `front`/`rear` trỏ đúng vào phần tử duy nhất qua `peek()`.
- **Nhiều phần tử liên tiếp (A $\rightarrow$ B $\rightarrow$ C):** Kiểm tra thứ tự vào trước ra trước (FIFO), đảm bảo `enqueue` nối đúng vào sau `rear` mà không làm thay đổi phần tử đang đứng đầu (`front`), và giải phóng sạch bộ nhớ sau khi lấy hết phần tử.

**Kết quả thực thi:** Đạt **89/89 test cases** (80 test gốc + 9 test bổ sung của TV1), không phát sinh lỗi biên dịch hay sai lệch logic.

---

## 2. Đo hiệu năng (Benchmark) Queue Engine

### 2.1. Mục tiêu & Kịch bản đo
- **Mã nguồn:** `queue-engine/benchmark/benchmark_queue.cpp` (chi tiết xem tại `queue-engine/benchmark/KET_QUA_BENCHMARK.md`).
- **Phương pháp:** Sử dụng thư viện `<chrono>` (`high_resolution_clock`) với cờ tối ưu `-O2` để đo tổng thời gian thực hiện liên tiếp $n$ thao tác `enqueue` và $n$ thao tác `dequeue` giữa **Linked List Queue** (Danh sách liên kết đơn quản lý 2 con trỏ `front`, `rear`) và **Array Queue** (Hàng đợi dùng mảng tuyến tính phải dịch chuyển phần tử khi `dequeue`).

### 2.2. Bảng số liệu thực nghiệm

| Quy mô đơn hàng ($n$) | Linked List Queue (ms) | Array Queue (ms) | Nhận xét & Mức độ chênh lệch |
| :---: | :---: | :---: | :--- |
| **1.000** | `0.0486` | `0.0177` | Array nhanh hơn ~2.7x nhờ tận dụng CPU Cache cho vùng nhớ liền kề. |
| **10.000** | `0.9422` | `48.9983` | **Linked List nhanh hơn 52.0 lần** do Array bắt đầu tốn chi phí dời mảng. |
| **100.000** | `7.3379` | `5582.4145` | **Linked List nhanh hơn 760.8 lần**, chứng minh rõ $O(n)$ vs $O(n^2)$. |

### 2.3. Kết luận thuật toán
Khi số lượng đơn hàng tăng gấp 10 lần từ $10.000$ lên $100.000$, thời gian xử lý của `LinkedListQueue` chỉ tăng tuyến tính (~7.8 lần, tương ứng độ phức tạp $O(1)$ cho mỗi thao tác), trong khi `ArrayQueue` tăng hơn 113 lần ($O(n^2)$) và không giới hạn sức chứa động. Điều này khẳng định thiết kế `Queue Engine` bằng Danh sách liên kết đơn là tối ưu cho hệ thống BeautyStore.

---

## 3. Giao diện Khách hàng (Frontend React + TypeScript)

### 3.1. Công nghệ & Mã nguồn
- **Công nghệ:** React 18, TypeScript, Tailwind CSS, Vite.
- **Mã nguồn:** `frontend/src/App.tsx`, `frontend/src/api.ts`.

### 3.2. Các tính năng đã hoàn thiện
1. **Trang chủ & Danh mục mỹ phẩm:** Hiển thị banner thương hiệu BeautyStore và lưới sản phẩm mỹ phẩm trực quan (hình ảnh, phân loại, giá bán VNĐ, nhãn nổi bật).
2. **Tìm kiếm & Lọc thời gian thực:** Tối ưu hóa trải nghiệm tìm kiếm theo từ khóa tên sản phẩm kết hợp lọc nhanh theo 5 danh mục (*Sữa rửa mặt, Toner, Serum, Kem dưỡng, Kem chống nắng*) bằng `useMemo`.
3. **Xem chi tiết & Tích hợp Giỏ hàng:**
   - Cho phép xem chi tiết mô tả, thành phần sản phẩm và tùy chỉnh số lượng mua.
   - Tích hợp hàm `addToCart()` đồng bộ dữ liệu giỏ hàng qua `localStorage` (`beautystore_cart`), kết nối liền mạch sang luồng Đặt hàng (`createOrder`) và Tra cứu trạng thái đơn hàng theo số điện thoại (`getOrdersByPhone`).

---

## 4. Kết luận chung
Toàn bộ các đầu việc của TV1 từ kiểm thử đơn vị, chứng minh hiệu năng cấu trúc dữ liệu C++ đến giao diện người dùng phía khách hàng đều đã hoàn thiện, chạy ổn định và tích hợp đồng bộ với các phân hệ Backend/Database của cả nhóm.
