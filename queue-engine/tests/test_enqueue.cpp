// ============================================================
// test_enqueue.cpp - Kiem thu ENQUEUE (TV1, du an BeautyStore)
//
// Moi test in PASS hoac FAIL, cuoi cung in tong ket.
// Neu co test loi thi chuong trinh thoat voi ma 1.
//
// Bien dich va chay (tu thu muc queue-engine/):
//   g++ -std=c++17 -Wall -Wextra -o test_enqueue tests/test_enqueue.cpp
//   ./test_enqueue          (Windows PowerShell: .\test_enqueue)
// ============================================================

#include <iostream>
#include <string>
#include "../src/queue_engine.h"
using namespace std;

int soTest = 0;
int soDat = 0;

// Ghi nhan ket qua mot test
void kiemTra(bool dieuKien, const string& moTa) {
    soTest++;
    if (dieuKien) {
        soDat++;
        cout << "PASS  " << moTa << endl;
    } else {
        cout << "FAIL  " << moTa << endl;
    }
}

// Them nhanh mot don vao hang
void them(Queue& q, int id) {
    q.enqueue(new Node(id));
}

// Lay mot don ra, tra -1 neu hang rong
int lay(Queue& q) {
    int id = 0;
    if (q.dequeue(id) == false) {
        return -1;
    }
    return id;
}

// Xem don dau hang, tra -1 neu hang rong
int xem(Queue& q) {
    int id = 0;
    if (q.peek(id) == false) {
        return -1;
    }
    return id;
}

int main() {
    // ---------- 1. Hang rong ----------
    cout << "--- Enqueue: hang rong ---" << endl;
    {
        Queue q;
        kiemTra(q.isEmpty(), "Hang moi tao la hang rong");
        kiemTra(q.getSize() == 0, "Hang moi tao co size = 0");
        kiemTra(xem(q) == -1, "Hang rong thi peek that bai");
    }

    // ---------- 2. Them mot don vao hang rong ----------
    cout << "--- Enqueue: them mot don vao hang rong ---" << endl;
    {
        Queue q;
        them(q, 101);
        kiemTra(q.isEmpty() == false, "Sau khi them 101, hang khong con rong");
        kiemTra(q.getSize() == 1, "Sau khi them 101, size = 1");
        kiemTra(xem(q) == 101, "Front la 101");
        kiemTra(lay(q) == 101, "Lay ra duoc dung 101");
        kiemTra(q.isEmpty(), "Lay xong thi hang lai rong");
    }

    // ---------- 3. Them nhieu don A, B, C ----------
    cout << "--- Enqueue: them nhieu don A(201), B(202), C(203) ---" << endl;
    {
        Queue q;
        them(q, 201);
        them(q, 202);
        them(q, 203);
        kiemTra(q.getSize() == 3, "Them 3 don thi size = 3");
        kiemTra(xem(q) == 201, "Front la don them dau tien (201)");
        kiemTra(lay(q) == 201, "Lay lan 1 ra 201 (A)");
        kiemTra(lay(q) == 202, "Lay lan 2 ra 202 (B)");
        kiemTra(lay(q) == 203, "Lay lan 3 ra 203 (C)");
        kiemTra(lay(q) == -1, "Lay lan 4: hang da rong");
    }

    // ---------- 4. Enqueue khong lam doi front ----------
    cout << "--- Enqueue: front khong doi khi them tiep ---" << endl;
    {
        Queue q;
        them(q, 1);
        kiemTra(xem(q) == 1, "Them 1: front = 1");
        them(q, 2);
        kiemTra(xem(q) == 1, "Them 2: front van la 1");
        them(q, 3);
        kiemTra(xem(q) == 1, "Them 3: front van la 1");
        kiemTra(q.getSize() == 3, "Size = 3, peek khong lam mat don nao");
    }

    // ---------- 5. Size tang dung ----------
    cout << "--- Enqueue: size tang moi lan them ---" << endl;
    {
        Queue q;
        bool dung = true;
        for (int i = 1; i <= 50; i++) {
            them(q, i);
            if (q.getSize() != i) {
                dung = false;
            }
        }
        kiemTra(dung, "Them 50 don, size luon bang so don da them");
    }

    // ---------- 6. Them xen ke voi lay ----------
    cout << "--- Enqueue: them xen ke voi dequeue ---" << endl;
    {
        Queue q;
        them(q, 10);
        them(q, 20);
        kiemTra(lay(q) == 10, "Lay ra 10");
        them(q, 30);
        kiemTra(lay(q) == 20, "Lay ra 20");
        kiemTra(lay(q) == 30, "Lay ra 30");
        kiemTra(q.isEmpty(), "Hang rong sau khi lay het");
    }

    // ---------- 7. Lay het roi them lai ----------
    cout << "--- Enqueue: them lai sau khi hang da rong ---" << endl;
    {
        Queue q;
        them(q, 5);
        lay(q);
        kiemTra(q.isEmpty(), "Lay het thi hang rong");
        them(q, 6);
        them(q, 7);
        kiemTra(q.getSize() == 2, "Them lai 2 don thi size = 2");
        kiemTra(xem(q) == 6, "Front moi la 6, khong con dinh don cu");
        kiemTra(lay(q) == 6, "Lay ra 6");
        kiemTra(lay(q) == 7, "Lay ra 7");
    }

    // ---------- 8. Them sau CLEAR ----------
    cout << "--- Enqueue: them sau khi clear ---" << endl;
    {
        Queue q;
        them(q, 1);
        them(q, 2);
        q.clear();
        kiemTra(q.isEmpty() && q.getSize() == 0, "Clear xong hang rong, size = 0");
        them(q, 9);
        kiemTra(q.getSize() == 1 && xem(q) == 9, "Them 9 sau clear: size = 1, front = 9");
    }

    // ---------- 9. Id bien ----------
    cout << "--- Enqueue: gia tri id bien ---" << endl;
    {
        Queue q;
        them(q, 1);
        them(q, 2147483647);
        kiemTra(lay(q) == 1, "Id nho nhat 1");
        kiemTra(lay(q) == 2147483647, "Id lon nhat 2147483647");
    }

    // ---------- 10. Nhieu phan tu ----------
    cout << "--- Enqueue: 100.000 don ---" << endl;
    {
        Queue q;
        const int N = 100000;
        for (int i = 1; i <= N; i++) {
            them(q, i);
        }
        kiemTra(q.getSize() == N, "Them 100.000 don, size = 100.000");
        bool dungThuTu = true;
        for (int i = 1; i <= N; i++) {
            if (lay(q) != i) {
                dungThuTu = false;
                break;
            }
        }
        kiemTra(dungThuTu, "Lay ra 100.000 don dung thu tu FIFO");
        kiemTra(q.isEmpty(), "Lay het thi hang rong");
    }

    // ---------- 11. Lenh ENQ qua giao thuc ----------
    cout << "--- Lenh ENQ qua giao thuc ---" << endl;
    {
        QueueEngine e;
        kiemTra(e.xuLyLenh("ENQ 101") == "OK", "ENQ 101 tra OK");
        kiemTra(e.xuLyLenh("ENQ 102") == "OK", "ENQ 102 tra OK");
        kiemTra(e.xuLyLenh("SIZE") == "SIZE 2", "Sau 2 lan ENQ, SIZE = 2");
        kiemTra(e.xuLyLenh("PEEK") == "ID 101", "PEEK ra 101 (don them dau tien)");
        kiemTra(e.xuLyLenh("ENQ 007") == "OK", "ENQ 007 duoc chap nhan");
        kiemTra(e.xuLyLenh("ENQ 00000000007") == "OK", "ENQ 00000000007 (nhieu so 0 dau) duoc chap nhan");
        kiemTra(e.xuLyLenh("ENQ 0") == "ERR BAD_ID", "ENQ 0 tra ERR BAD_ID");
        kiemTra(e.xuLyLenh("ENQ -5") == "ERR BAD_ID", "ENQ -5 tra ERR BAD_ID");
        kiemTra(e.xuLyLenh("ENQ abc") == "ERR BAD_ID", "ENQ abc tra ERR BAD_ID");
        kiemTra(e.xuLyLenh("ENQ 1.5") == "ERR BAD_ID", "ENQ 1.5 tra ERR BAD_ID");
        kiemTra(e.xuLyLenh("ENQ 2147483648") == "ERR BAD_ID", "ENQ 2147483648 (qua gioi han) tra ERR BAD_ID");
        kiemTra(e.xuLyLenh("ENQ") == "ERR BAD_COMMAND", "ENQ thieu tham so tra ERR BAD_COMMAND");
        kiemTra(e.xuLyLenh("ENQ 1 2") == "ERR BAD_COMMAND", "ENQ thua tham so tra ERR BAD_COMMAND");
        kiemTra(e.xuLyLenh("SIZE") == "SIZE 4", "ENQ loi khong lam thay doi hang: SIZE = 4");
    }

    // ---------- Tong ket ----------
    cout << endl << "=== TONG KET: " << soDat << "/" << soTest << " test dat ===" << endl;
    return (soDat == soTest) ? 0 : 1;
}
