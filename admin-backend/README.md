# Hướng dẫn sử dụng Admin Dashboard & Cầu nối C++ (TV5 & TV6)

Thư mục `admin-backend` chứa trang quản lý đơn hàng dành cho Admin và phần kết nối giữa Web với chương trình hàng đợi C++ (của TV4).

## 1. Hệ thống này hoạt động như thế nào?
* **Giao diện quản lý (`admin.html`):** Hiển thị bảng danh sách đơn hàng và nút **"Xử lý đơn tiếp theo (DEQ)"** để Admin duyệt đơn.
* **Tự động lọc đơn hủy (`server.js`):** Khi Admin bấm duyệt đơn, hệ thống lấy mã đơn đứng đầu hàng đợi C++. Nếu khách đã hủy đơn đó trước đó (`CANCELLED`), hệ thống tự động bỏ qua và lấy ngay đơn hợp lệ kế tiếp (`PENDING` $\rightarrow$ `APPROVED`).
* **Cầu nối C++ (`queueClient.js`):** Tự động bật chương trình C++ chạy ngầm cùng lúc với server web; nếu chương trình C++ lỡ bị tắt, hệ thống tự khởi động lại và nạp lại các đơn đang chờ.

---

## 2. Cách chạy thử giao diện (Chỉ mất 30 giây)

Nếu bạn muốn mở trang Admin lên xem thử hoặc test chức năng, hãy làm đúng 3 bước sau:

**Bước 1:** Mở khung **Terminal**, copy và chạy lần lượt các lệnh sau:
```bash
cd admin-backend
g++ -std=c++17 -o queue_engine queue_engine.cpp
npm init -y && npm install express
node server.js
```

**Bước 2:** Mở trình duyệt tại địa chỉ **`http://localhost:3000`** (nếu dùng GitHub Codespaces thì bấm nút **Mở trong trình duyệt** ở góc dưới bên phải màn hình).

**Bước 3:** Trải nghiệm thử trên trang web:
* Hệ thống đã tạo sẵn 4 đơn mẫu (`#101`, `#102` đã hủy; `#103`, `#104` đang chờ duyệt).
* Hãy bấm nút xanh **"Xử lý đơn tiếp theo (DEQ)"** ở góc trên bên phải để xem hệ thống tự động bỏ qua 2 đơn hủy đầu tiên và duyệt đơn `#103`.

---

## 3. Hướng dẫn dành riêng cho TV3 (Ghép Database MySQL)

Hiện tại trang Admin đang dùng 4 đơn hàng mẫu (`mockOrders`) để chạy độc lập. Khi ghép với Database MySQL thật, **TV3** chỉ cần mở tệp **`server.js`**, bấm **`Ctrl + F`** tìm từ khóa **`[TODO - TV3]`** và làm 2 việc sau:

1. **Ở API đặt hàng của TV3 (khi khách tạo đơn mới):**
   Sau khi lưu đơn hàng mới (`PENDING`) vào MySQL thành công, gọi thêm 1 dòng này để đẩy mã đơn vào hàng đợi C++:
   ```javascript
   await queueClient.enq(idDonHangMoi);
   ```
2. **Ở tệp `server.js` của thư mục này:**
   Thay mảng dữ liệu mẫu `mockOrders` bằng câu lệnh truy vấn MySQL thật (đã viết sẵn dạng chú thích ngay tại các vị trí `[TODO - TV3]`).

---

## 4. Chức năng từng tệp trong thư mục này

* **`admin.html`**: Giao diện bảng đơn hàng và các nút bấm của Admin.
* **`server.js`**: Xử lý logic duyệt đơn, bỏ qua đơn hủy và cung cấp API cho giao diện.
* **`queueClient.js`**: Gửi lệnh (`ENQ`, `DEQ`, `CLEAR`) từ Node.js sang chương trình C++.
* **`queue_engine.cpp` & `queue_engine.h`**: Code hàng đợi C++ (lấy từ thư mục của TV4 sang để chạy độc lập).