# Báo cáo kiểm tra bộ nhớ – Queue Engine (TV2)

## 1. Môi trường
- Ubuntu (WSL2) trên Windows, g++ 15.2.0, Valgrind 3.26.0
- Mã nguồn: thư mục queue-engine/ (src/queue_engine.cpp, tests/test_queue.cpp)

## 2. AddressSanitizer + UndefinedBehaviorSanitizer
Lệnh:

    g++ -std=c++17 -g -fsanitize=address,undefined -o test_asan tests/test_queue.cpp
    ./test_asan

Kết quả: 80/80 test đạt; không có lỗi truy cập vùng nhớ sai,
không có rò rỉ, không có hành vi không xác định.
Các nhóm test liên quan dequeue: hàng rỗng, một phần tử, nhiều phần tử,
FIFO, lấy hết rồi thêm lại, 100.000 phần tử, hủy Queue khi còn phần tử.

## 3. Valgrind (chạy trên chương trình Engine)
Lệnh:

    g++ -std=c++17 -g -o queue_engine src/queue_engine.cpp
    printf 'DEQ\nENQ 5\nDEQ\nDEQ\nENQ 1\nENQ 2\nENQ 3\nDEQ\nCLEAR\nENQ 9\n' \
      | valgrind --leak-check=full --error-exitcode=1 ./queue_engine

Kết quả: 8 allocs, 8 frees; "All heap blocks were freed -- no leaks
are possible"; ERROR SUMMARY: 0 errors.
Kịch bản gồm: DEQ khi rỗng, DEQ phần tử duy nhất, DEQ nhiều phần tử,
CLEAR, và kết thúc khi hàng vẫn còn phần tử (ENQ 9).

## 4. Kết luận
Không phát hiện rò rỉ bộ nhớ hay truy cập sai vùng nhớ; không cần sửa mã.
Dequeue giải phóng Node cũ đúng, front/rear về nullptr khi lấy phần tử cuối.
