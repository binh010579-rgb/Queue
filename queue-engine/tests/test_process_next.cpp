// ============================================================
// test_process_next.cpp - Kiem thu thuat toan "xu ly don tiep theo" (TV5)
//
// Test goi API that cua server.cpp, nen CAN CHAY SERVER TRUOC.
// Nen chay server rieng de khong dung vao du lieu that:
//
//   Linux/macOS:  ORDERS_DB=/tmp/test_db.json PORT=18080 ./server
//   PowerShell:   $env:ORDERS_DB="test_db.json"; $env:PORT="18080"; .\server
//
// Roi bien dich va chay test (tu thu muc queue-engine/):
//   g++ -std=c++17 -Wall -Wextra -o test_process_next tests/test_process_next.cpp -pthread
//   ./test_process_next 18080        (Windows: them -lws2_32, chay .\test_process_next 18080)
//
// Dau tien test se duyet het don dang cho trong hang de bat dau tu hang rong.
// ============================================================

#include <iostream>
#include <string>
#include <utility>
#include <vector>

#include "../src/httplib.h"
#include "../src/json.hpp"

using namespace std;
using json = nlohmann::json;

int soTest = 0;
int soDat = 0;
httplib::Client* mayKhach = nullptr;

void kiemTra(bool dieuKien, const string& moTa) {
    soTest++;
    if (dieuKien) {
        soDat++;
        cout << "PASS  " << moTa << endl;
    } else {
        cout << "FAIL  " << moTa << endl;
    }
}

// Goi API: tra ve (ma HTTP, noi dung JSON). Khong ket noi duoc thi ma = 0.
pair<int, json> goi(const string& method, const string& path, const json& body = json::object()) {
    httplib::Result r(nullptr, httplib::Error::Unknown);
    if (method == "GET") {
        r = mayKhach->Get(path);
    } else {
        r = mayKhach->Post(path, body.dump(), "application/json");
    }
    if (!r) {
        return {0, json::object()};
    }
    json noiDung = json::parse(r->body, nullptr, false);
    if (noiDung.is_discarded()) {
        noiDung = json::object();
    }
    return {r->status, noiDung};
}

int taoDon() {
    json body = {{"customerName", "Khach"}, {"phone", "0900000001"}, {"address", "x"},
                 {"items", json::array()}, {"total", 100}};
    auto kq = goi("POST", "/api/orders", body);
    return kq.second.value("orderId", -1);
}

string trangThai(int id) {
    auto kq = goi("GET", "/api/admin/orders");
    for (const auto& o : kq.second) {
        if (o.value("orderId", -1) == id) {
            return o.value("status", "");
        }
    }
    return "";
}

int main(int argc, char* argv[]) {
    int cong = (argc > 1) ? atoi(argv[1]) : 8080;
    httplib::Client client("127.0.0.1", cong);
    client.set_connection_timeout(3);
    client.set_read_timeout(5);
    mayKhach = &client;

    if (goi("GET", "/api/admin/orders").first != 200) {
        cout << "Khong ket noi duoc server o cong " << cong << ". Hay chay server truoc." << endl;
        return 1;
    }

    // ---------- Dua hang cho ve trang thai rong ----------
    while (goi("POST", "/api/orders/process-next").first == 200) {
    }

    cout << "--- Test 1: don hop le ---" << endl;
    {
        int a = taoDon();
        auto kq = goi("POST", "/api/orders/process-next");
        kiemTra(kq.first == 200 && kq.second.value("orderId", -1) == a, "Duyet duoc don dau hang");
        kiemTra(kq.second.value("skipped", -1) == 0, "Khong bo qua don nao");
        kiemTra(trangThai(a) == "APPROVED", "Don chuyen sang APPROVED");
    }

    cout << "--- Test 2: mot don da huy giua hang cho ---" << endl;
    {
        int b = taoDon();
        int c = taoDon();
        kiemTra(goi("POST", "/api/orders/" + to_string(b) + "/cancel").first == 200,
                "Huy don PENDING thanh cong");
        auto kq = goi("POST", "/api/orders/process-next");
        kiemTra(kq.first == 200 && kq.second.value("orderId", -1) == c,
                "Bo qua don da huy, duyet don ke tiep");
        kiemTra(kq.second.value("skipped", -1) == 1, "Bo qua dung 1 don");
        kiemTra(trangThai(b) == "CANCELLED", "Don da huy van la CANCELLED");
        kiemTra(trangThai(c) == "APPROVED", "Don ke tiep la APPROVED");
    }

    cout << "--- Test 3: nhieu don huy lien tiep ---" << endl;
    {
        int d = taoDon(), e = taoDon(), f = taoDon(), g = taoDon();
        goi("POST", "/api/orders/" + to_string(d) + "/cancel");
        goi("POST", "/api/orders/" + to_string(e) + "/cancel");
        goi("POST", "/api/orders/" + to_string(f) + "/cancel");
        auto kq = goi("POST", "/api/orders/process-next");
        kiemTra(kq.first == 200 && kq.second.value("orderId", -1) == g,
                "Bo qua 3 don huy, duyet don cuoi");
        kiemTra(kq.second.value("skipped", -1) == 3, "Bo qua dung 3 don");
        kiemTra(trangThai(d) == "CANCELLED" && trangThai(e) == "CANCELLED" && trangThai(f) == "CANCELLED",
                "3 don huy khong bi doi trang thai");
    }

    cout << "--- Test 4: queue rong ---" << endl;
    {
        auto kq = goi("POST", "/api/orders/process-next");
        kiemTra(kq.first == 400, "Queue rong tra ma 400");
        kiemTra(kq.second.value("message", "").find("rong") != string::npos,
                "Co thong bao hang doi rong");
        int h = taoDon();
        int i = taoDon();
        goi("POST", "/api/orders/" + to_string(h) + "/cancel");
        goi("POST", "/api/orders/" + to_string(i) + "/cancel");
        kq = goi("POST", "/api/orders/process-next");
        kiemTra(kq.first == 400 && kq.second.value("skipped", -1) == 2,
                "Toan don huy: bo qua het roi bao rong");
    }

    cout << "--- Them: thu tu FIFO ---" << endl;
    vector<int> ids;
    {
        for (int k = 0; k < 5; k++) {
            ids.push_back(taoDon());
        }
        vector<int> thuTu;
        for (int k = 0; k < 5; k++) {
            thuTu.push_back(goi("POST", "/api/orders/process-next").second.value("orderId", -1));
        }
        kiemTra(thuTu == ids, "Duyet dung thu tu vao truoc ra truoc");
    }

    cout << "--- Them: doi trang thai ---" << endl;
    {
        string dau = to_string(ids[0]);
        kiemTra(goi("POST", "/api/orders/" + dau + "/cancel").first == 409,
                "Khong huy duoc don da APPROVED (409)");
        kiemTra(goi("POST", "/api/orders/" + dau + "/complete").first == 200 &&
                    trangThai(ids[0]) == "COMPLETED",
                "APPROVED -> COMPLETED");
        kiemTra(goi("POST", "/api/orders/" + dau + "/complete").first == 409,
                "Khong hoan thanh lai don COMPLETED (409)");
        int moi = taoDon();
        kiemTra(goi("POST", "/api/orders/" + to_string(moi) + "/complete").first == 409,
                "Khong hoan thanh duoc don PENDING (409)");
        kiemTra(goi("POST", "/api/orders/999999/cancel").first == 404,
                "Huy don khong ton tai tra 404");
        auto ds = goi("GET", "/api/admin/orders?status=PENDING");
        kiemTra(ds.first == 200 && ds.second.size() == 1 && ds.second[0].value("orderId", -1) == moi,
                "Loc theo status=PENDING");
        goi("POST", "/api/orders/process-next");   // don dep: duyet don 'moi' de hang ve rong
    }

    cout << endl << "=== TONG KET: " << soDat << "/" << soTest << " test dat ===" << endl;
    return (soDat == soTest) ? 0 : 1;
}
