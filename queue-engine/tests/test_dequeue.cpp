// ============================================================
// test_dequeue.cpp - Kiem thu DEQUEUE (TV2, du an BeautyStore)
//
// Kiem thu ham Queue::dequeue va lenh DEQ cua QueueEngine:
//   1. Hang rong
//   2. Hang co 1 phan tu (front va rear cung ve nullptr)
//   3. Hang co nhieu phan tu (thu tu FIFO)
//   4. Dequeue xen ke voi enqueue
//   5. Lay het roi them lai (chung minh rear da ve nullptr dung)
//   6. Lenh DEQ qua giao thuc (QueueEngine)
//   7. Hang lon 100.000 phan tu (dung voi ASan de bat ro ri bo nho)
//
// Ghi chu: front/rear la thanh vien private. De kiem tra truc tiep rang
// dequeue phan tu cuoi dua CA front lan rear ve nullptr, file nay mo
// private thanh public (chi trong file test, khong anh huong ma nguon).
// Can lam vay vi enqueue kiem tra hang rong bang front roi gan lai rear,
// nen neu rear bi "treo" thi khong the thay duoc qua cac ham cong khai.
//
// Bien dich (chay trong thu muc queue-engine/):
//   g++ -std=c++17 -Wall -Wextra -o test_dequeue tests/test_dequeue.cpp
// Kiem tra bo nho:
//   g++ -std=c++17 -Wall -Wextra -fsanitize=address,undefined -g -o test_dequeue tests/test_dequeue.cpp
// Dong cuoi phai la "=== TONG KET: X/X test dat ===", co test loi thi thoat ma 1.
// ============================================================

#include <iostream>
#include <sstream>
#include <string>
#define private public      // chi de test doc duoc front/rear
#include "../src/queue_engine.h"
#undef private
using namespace std;

int soTest = 0;
int soDat = 0;

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

// Gui mot lenh vao Engine va so voi ket qua mong doi
void kiemTraLenh(QueueEngine& e, const string& lenh, const string& mongDoi) {
    string ketQua = e.xuLyLenh(lenh);
    kiemTra(ketQua == mongDoi,
            "Lenh \"" + lenh + "\" -> " + mongDoi + " (nhan duoc: " + ketQua + ")");
}

// ------------------------------------------------------------
// 1. Hang rong
// ------------------------------------------------------------
void testHangRong() {
    cout << "--- Dequeue: hang rong ---" << endl;
    Queue q;
    int id = 999;                                   // gia tri mau de xem co bi ghi de khong
    kiemTra(q.dequeue(id) == false, "Hang rong: dequeue tra false");
    kiemTra(id == 999, "Hang rong: dequeue khong ghi de len bien dau ra");
    kiemTra(q.getSize() == 0, "Hang rong: size van bang 0");
    kiemTra(q.isEmpty(), "Hang rong: van la hang rong");
    kiemTra(q.dequeue(id) == false, "Hang rong: dequeue lan 2 van tra false, khong loi");
    kiemTra(q.peek(id) == false, "Hang rong: peek van tra false");
}

// ------------------------------------------------------------
// 2. Hang co dung 1 phan tu
// ------------------------------------------------------------
void testMotPhanTu() {
    cout << "--- Dequeue: hang co 1 phan tu ---" << endl;
    Queue q;
    int id = 0;
    them(q, 42);
    kiemTra(q.getSize() == 1, "1 phan tu: size = 1 truoc khi lay");
    kiemTra(q.dequeue(id) == true, "1 phan tu: dequeue tra true");
    kiemTra(id == 42, "1 phan tu: lay dung don 42");
    kiemTra(q.front == nullptr, "1 phan tu: lay xong front = nullptr");
    kiemTra(q.rear == nullptr, "1 phan tu: lay xong rear = nullptr");
    kiemTra(q.isEmpty(), "1 phan tu: lay xong thi hang rong");
    kiemTra(q.getSize() == 0, "1 phan tu: lay xong size = 0");
    kiemTra(q.peek(id) == false, "1 phan tu: lay xong peek tra false");
    kiemTra(q.dequeue(id) == false, "1 phan tu: lay lan 2 tra false");
}

// ------------------------------------------------------------
// 3. Hang co nhieu phan tu: dung thu tu FIFO
// ------------------------------------------------------------
void testNhieuPhanTu() {
    cout << "--- Dequeue: hang co nhieu phan tu ---" << endl;
    Queue q;
    int id = 0;
    for (int i = 1; i <= 5; i++) {
        them(q, i * 10);                            // 10, 20, 30, 40, 50
    }
    kiemTra(q.getSize() == 5, "Nhieu: them 5 don thi size = 5");
    kiemTra(q.front != nullptr && q.rear != nullptr && q.front != q.rear,
            "Nhieu: front va rear tro vao hai node khac nhau");

    for (int i = 1; i <= 5; i++) {
        int mongDoi = i * 10;
        kiemTra(q.peek(id) && id == mongDoi,
                "Nhieu: truoc lan lay " + to_string(i) + ", front la " + to_string(mongDoi));
        kiemTra(lay(q) == mongDoi,
                "Nhieu: lan lay " + to_string(i) + " ra " + to_string(mongDoi));
        kiemTra(q.getSize() == 5 - i,
                "Nhieu: sau lan lay " + to_string(i) + " size = " + to_string(5 - i));
    }
    kiemTra(q.isEmpty(), "Nhieu: lay het thi hang rong");
    kiemTra(lay(q) == -1, "Nhieu: lay them mot lan nua thi bao rong");
}

// ------------------------------------------------------------
// 4. Dequeue xen ke enqueue
// ------------------------------------------------------------
void testXenKe() {
    cout << "--- Dequeue: xen ke voi enqueue ---" << endl;
    Queue q;
    them(q, 1);
    them(q, 2);
    kiemTra(lay(q) == 1, "Xen ke: lay ra 1");
    kiemTra(q.front == q.rear && q.front != nullptr, "Xen ke: con 1 don thi front trung rear");
    them(q, 3);
    kiemTra(lay(q) == 2, "Xen ke: lay ra 2");
    kiemTra(lay(q) == 3, "Xen ke: lay ra 3");
    kiemTra(q.isEmpty(), "Xen ke: het don thi hang rong");
    them(q, 4);
    kiemTra(lay(q) == 4, "Xen ke: them 4 vao hang rong roi lay ra 4");
    kiemTra(q.isEmpty() && q.getSize() == 0, "Xen ke: cuoi cung hang rong, size = 0");
}

// ------------------------------------------------------------
// 5. Lay het roi them lai (kiem tra rear da ve nullptr)
// ------------------------------------------------------------
void testLayHetRoiThemLai() {
    cout << "--- Dequeue: lay het roi them lai ---" << endl;
    Queue q;
    // Lap nhieu vong: moi vong them 3 don, lay het 3 don
    for (int vong = 1; vong <= 3; vong++) {
        int goc = vong * 100;
        them(q, goc + 1);
        them(q, goc + 2);
        them(q, goc + 3);
        kiemTra(lay(q) == goc + 1, "Vong " + to_string(vong) + ": lay ra " + to_string(goc + 1));
        kiemTra(lay(q) == goc + 2, "Vong " + to_string(vong) + ": lay ra " + to_string(goc + 2));
        kiemTra(lay(q) == goc + 3, "Vong " + to_string(vong) + ": lay ra " + to_string(goc + 3));
        kiemTra(q.isEmpty(), "Vong " + to_string(vong) + ": hang rong sau khi lay het");
        kiemTra(q.front == nullptr && q.rear == nullptr,
                "Vong " + to_string(vong) + ": front va rear deu = nullptr sau khi lay het");
    }
    // Truong hop dac biet: hang chi co 1 don, lay ra roi them lai ngay
    them(q, 7);
    kiemTra(lay(q) == 7, "Them 7 roi lay ra 7");
    them(q, 8);
    them(q, 9);
    kiemTra(q.getSize() == 2, "Them lai sau khi lay het: size = 2");
    kiemTra(lay(q) == 8, "Them lai sau khi lay het: ra 8");
    kiemTra(lay(q) == 9, "Them lai sau khi lay het: ra 9");
}

// ------------------------------------------------------------
// 6. Lenh DEQ qua giao thuc
// ------------------------------------------------------------
void testLenhDEQ() {
    cout << "--- Lenh DEQ qua giao thuc ---" << endl;
    {
        QueueEngine e;
        kiemTraLenh(e, "DEQ", "EMPTY");
        kiemTraLenh(e, "SIZE", "SIZE 0");
    }
    {
        QueueEngine e;
        kiemTraLenh(e, "ENQ 101", "OK");
        kiemTraLenh(e, "DEQ", "ID 101");
        kiemTraLenh(e, "DEQ", "EMPTY");
        kiemTraLenh(e, "SIZE", "SIZE 0");
    }
    {
        QueueEngine e;
        kiemTraLenh(e, "ENQ 5", "OK");
        kiemTraLenh(e, "ENQ 7", "OK");
        kiemTraLenh(e, "ENQ 9", "OK");
        kiemTraLenh(e, "DEQ", "ID 5");
        kiemTraLenh(e, "SIZE", "SIZE 2");
        kiemTraLenh(e, "PEEK", "ID 7");
        kiemTraLenh(e, "DEQ", "ID 7");
        kiemTraLenh(e, "DEQ", "ID 9");
        kiemTraLenh(e, "DEQ", "EMPTY");
    }
    {
        QueueEngine e;
        kiemTraLenh(e, "ENQ 3", "OK");
        kiemTraLenh(e, "CLEAR", "OK");
        kiemTraLenh(e, "DEQ", "EMPTY");
        kiemTraLenh(e, "ENQ 4", "OK");
        kiemTraLenh(e, "DEQ", "ID 4");
    }
    {
        QueueEngine e;
        kiemTraLenh(e, "ENQ 1", "OK");
        kiemTraLenh(e, "DEQ 1", "ERR BAD_COMMAND");     // thua tham so
        kiemTraLenh(e, "deq", "ERR BAD_COMMAND");       // viet thuong la lenh sai
        kiemTraLenh(e, "SIZE", "SIZE 1");               // lenh sai khong lam mat don
        kiemTraLenh(e, "DEQ", "ID 1");
        kiemTraLenh(e, "DEQ\r", "EMPTY");               // cuoi dong kieu Windows
    }
}

// ------------------------------------------------------------
// 7. Hang lon: dung voi ASan de bat ro ri bo nho
// ------------------------------------------------------------
void testHangLon() {
    cout << "--- Dequeue: 100.000 phan tu ---" << endl;
    const int N = 100000;
    Queue q;
    for (int i = 1; i <= N; i++) {
        them(q, i);
    }
    bool dungThuTu = true;
    for (int i = 1; i <= N; i++) {
        if (lay(q) != i) {
            dungThuTu = false;
            break;
        }
    }
    kiemTra(dungThuTu, "Lay 100.000 don ra dung thu tu 1..100000");
    kiemTra(q.isEmpty() && q.getSize() == 0, "Lay het 100.000 don thi hang rong");

    // Them 1000 don roi de nguyen, khong lay: destructor phai giai phong het
    Queue q2;
    for (int i = 1; i <= 1000; i++) {
        them(q2, i);
    }
    kiemTra(q2.getSize() == 1000, "De lai 1000 don trong hang, destructor se giai phong");
}

int main() {
    testHangRong();
    testMotPhanTu();
    testNhieuPhanTu();
    testXenKe();
    testLayHetRoiThemLai();
    testLenhDEQ();
    testHangLon();

    cout << endl << "=== TONG KET: " << soDat << "/" << soTest << " test dat ===" << endl;
    return (soDat == soTest) ? 0 : 1;
}
