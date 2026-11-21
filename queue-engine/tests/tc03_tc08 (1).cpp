// ============================================================
// tc03_tc08.cpp - Kiem thu TC03..TC08 (TV2, BeautyStore)
// Dung Queue that trong ../src/queue_engine.h. KHONG can sanitizer.
//
// Dat file nay vao queue-engine/tests/ roi, tu thu muc queue-engine, chay:
//   g++ -std=c++17 -Wall -Wextra -g -o tc03_tc08 tests/tc03_tc08.cpp
//   .\tc03_tc08          (Windows PowerShell)   hoac   ./tc03_tc08  (Linux/WSL)
// ============================================================
#include <cstdlib>
#include <iostream>
#include <new>
#include <sstream>
#include <string>
#define private public      // chi de test doc duoc front/rear
#include "../src/queue_engine.h"
#undef private
using namespace std;

// ---- Dem so lan cap phat / giai phong (de chung minh Node duoc giai phong) ----
static long soNew = 0, soDelete = 0;
void* operator new(size_t n) {
    void* p = malloc(n);
    if (!p) throw bad_alloc();
    soNew++;
    return p;
}
void operator delete(void* p) noexcept { if (p) { soDelete++; free(p); } }
void operator delete(void* p, size_t) noexcept { if (p) { soDelete++; free(p); } }

static int soDat = 0, soTC = 0;

void ketLuan(const string& ma, const string& tenTC, const string& thucTe, bool dat) {
    soTC++;
    if (dat) soDat++;
    cout << ma << " " << tenTC << endl;
    cout << "     Thuc te: " << thucTe << endl;
    cout << "     Ket qua: " << (dat ? "PASS" : "FAIL") << endl << endl;
}

string nullHay(const void* p) { return p == nullptr ? "nullptr" : "khac nullptr"; }

int main() {
    cout << "=== KIEM THU TC03 - TC08 (Dequeue, Peek, Clear) ===" << endl << endl;

    // TC03: Dequeue Queue rong
    {
        Queue q;
        int id = 999;
        bool r = q.dequeue(id);
        QueueEngine e;
        string lenh = e.xuLyLenh("DEQ");
        bool dat = (r == false) && id == 999 && q.getSize() == 0 && lenh == "EMPTY";
        ketLuan("TC03", "Dequeue Queue rong",
                "dequeue tra " + string(r ? "true" : "false") + ", id van = " + to_string(id) +
                ", size = " + to_string(q.getSize()) + ", lenh DEQ -> " + lenh, dat);
    }

    // TC04: Dequeue Queue mot phan tu
    {
        Queue q;
        q.enqueue(new Node(1));
        int id = 0;
        bool r = q.dequeue(id);
        bool dat = r && id == 1 && q.front == nullptr && q.rear == nullptr && q.getSize() == 0;
        ketLuan("TC04", "Dequeue Queue mot phan tu",
                "tra " + string(r ? "true" : "false") + ", lay ra id = " + to_string(id) +
                ", front = " + nullHay(q.front) + ", rear = " + nullHay(q.rear) +
                ", size = " + to_string(q.getSize()), dat);
    }

    // TC05: Dequeue Queue nhieu phan tu (A=1, B=2, C=3)
    {
        Queue q;
        q.enqueue(new Node(1));
        q.enqueue(new Node(2));
        q.enqueue(new Node(3));
        int id = 0, dau = 0;
        bool r = q.dequeue(id);
        q.peek(dau);
        int rearId = q.rear ? q.rear->orderId : -1;
        int size = q.getSize();
        int b = 0, c = 0;                       // lay tiep de kiem tra thu tu B -> C
        q.dequeue(b);
        q.dequeue(c);
        bool dat = r && id == 1 && dau == 2 && rearId == 3 && size == 2 && b == 2 && c == 3;
        ketLuan("TC05", "Dequeue Queue nhieu phan tu (A -> B -> C)",
                "lay ra " + to_string(id) + ", front moi = " + to_string(dau) +
                ", rear = " + to_string(rearId) + ", size = " + to_string(size) +
                ", lay tiep ra " + to_string(b) + " roi " + to_string(c), dat);
    }

    // TC06: Peek Queue rong
    {
        Queue q;
        int id = 999;
        bool r = q.peek(id);
        QueueEngine e;
        string lenh = e.xuLyLenh("PEEK");
        bool dat = (r == false) && id == 999 && lenh == "EMPTY";
        ketLuan("TC06", "Peek Queue rong",
                "peek tra " + string(r ? "true" : "false") + ", id van = " + to_string(id) +
                ", lenh PEEK -> " + lenh, dat);
    }

    // TC07: Peek Queue co du lieu (A=1, B=2)
    {
        Queue q;
        q.enqueue(new Node(1));
        q.enqueue(new Node(2));
        Node* front0 = q.front;
        Node* rear0 = q.rear;
        int size0 = q.getSize();
        int id = 0;
        bool r = q.peek(id);
        int size1 = q.getSize();
        bool khongDoi = (q.front == front0) && (q.rear == rear0) && (size1 == size0);
        int sauPeek = 0;
        q.dequeue(sauPeek);                     // front van la A sau khi peek
        bool dat = r && id == 1 && khongDoi && sauPeek == 1;
        ketLuan("TC07", "Peek Queue co du lieu (A -> B)",
                "peek tra " + string(r ? "true" : "false") + ", id = " + to_string(id) +
                ", size " + to_string(size0) + " -> " + to_string(size1) +
                ", front/rear " + (khongDoi ? "khong doi" : "BI DOI") +
                ", dequeue ngay sau do van ra " + to_string(sauPeek), dat);
    }

    // TC08: Clear Queue nhieu phan tu + doi chieu so lan new/delete
    {
        long n0 = soNew, d0 = soDelete;
        Queue q;
        for (int i = 1; i <= 5; i++) q.enqueue(new Node(i));
        long capPhat = soNew - n0;
        q.clear();
        long giaiPhong = soDelete - d0;
        bool dat = q.getSize() == 0 && q.front == nullptr && q.rear == nullptr &&
                   capPhat == 5 && giaiPhong == 5;
        ketLuan("TC08", "Clear Queue (5 phan tu)",
                "size = " + to_string(q.getSize()) + ", front = " + nullHay(q.front) +
                ", rear = " + nullHay(q.rear) + ", Node cap phat = " + to_string(capPhat) +
                ", Node giai phong = " + to_string(giaiPhong), dat);
    }

    // Kiem tra bo sung: 100000 node, lay 60000, 40000 con lai do destructor giai phong
    {
        long n0 = soNew, d0 = soDelete;
        {
            Queue q;
            for (int i = 1; i <= 100000; i++) q.enqueue(new Node(i));
            int id;
            for (int i = 0; i < 60000; i++) q.dequeue(id);
        }
        long capPhat = soNew - n0, giaiPhong = soDelete - d0;
        cout << "Bo sung: 100000 Node (lay 60000 bang dequeue, 40000 con lai do destructor)" << endl;
        cout << "     Cap phat = " << capPhat << ", giai phong = " << giaiPhong << " -> "
             << (capPhat == giaiPhong ? "CAN BANG" : "LECH (ro ri bo nho!)") << endl << endl;
        if (capPhat != giaiPhong) soDat--;      // lech thi tinh la that bai
    }

    cout << "=== TONG KET: " << soDat << "/" << soTC << " test case PASS ===" << endl;
    return (soDat == soTC) ? 0 : 1;
}
