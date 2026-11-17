
// server.cpp - HTTP API Server nối Frontend BeautyStore với QueueEngine
// Biên dịch: g++ -std=c++17 -O2 src/server.cpp -o server -lws2_32 (trên Windows)
//            g++ -std=c++17 -O2 src/server.cpp -o server -pthread (trên Linux/Mac)

#include <chrono>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#include "httplib.h"
#include "json.hpp"
#include "queue_engine.h"

using json = nlohmann::json;
using namespace std;

const string DB_FILE = "orders_db.json";
mutex dataMutex;
QueueEngine engine;
json ordersStore = json::array(); // Lưu chi tiết đơn hàng (vì QueueEngine chỉ lưu orderId)
int nextOrderId = 1001;

// Lấy thời gian hiện tại chuẩn ISO-8601 cho Frontend (new Date(order.createdAt))
string getCurrentISOTime() {
    auto now = chrono::system_clock::now();
    time_t now_c = chrono::system_clock::to_time_t(now);
    tm utc_tm{};
#ifdef _WIN32
    gmtime_s(&utc_tm, &now_c);
#else
    gmtime_r(&now_c, &utc_tm);
#endif
    ostringstream oss;
    oss << put_time(&utc_tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

// Lưu danh sách đơn xuống file JSON
void saveDatabase() {
    ofstream out(DB_FILE);
    if (out.is_open()) {
        out << ordersStore.dump(2);
    }
}

// Đọc lại đơn cũ khi khởi động server và nạp các đơn PENDING vào QueueEngine
void loadDatabase() {
    ifstream in(DB_FILE);
    if (!in.is_open()) return;
    try {
        in >> ordersStore;
        if (!ordersStore.is_array()) ordersStore = json::array();
        for (const auto& ord : ordersStore) {
            int id = ord.value("orderId", 1000);
            if (id >= nextOrderId) nextOrderId = id + 1;
            if (ord.value("status", "") == "PENDING") {
                engine.xuLyLenh("ENQ " + to_string(id));
            }
        }
    } catch (...) {
        ordersStore = json::array();
    }
}

int main() {
    loadDatabase();
    httplib::Server svr;

    // 1. Cấu hình CORS cho phép Frontend (localhost:5173) gọi sang cổng 8080
    svr.set_default_headers({
        {"Access-Control-Allow-Origin", "*"},
        {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
        {"Access-Control-Allow-Headers", "Content-Type"}
    });

    svr.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) {
        res.status = 204;
    });

    // 2. API Tạo đơn hàng mới: POST /api/orders (khớp với createOrder trong api.ts)
    svr.Post("/api/orders", [](const httplib::Request& req, httplib::Response& res) {
        lock_guard<mutex> lock(dataMutex);
        try {
            json body = json::parse(req.body);
            int orderId = nextOrderId++;
            string createdAt = getCurrentISOTime();

            // Đẩy mã đơn vào QueueEngine của C++
            string qRes = engine.xuLyLenh("ENQ " + to_string(orderId));
            if (qRes != "OK") {
                res.status = 400;
                res.set_content(json{{"error", qRes}}.dump(), "application/json");
                return;
            }

            // Lưu thông tin đầy đủ của đơn hàng
            json newOrder = {
                {"orderId", orderId},
                {"customerName", body.value("customerName", "")},
                {"phone", body.value("phone", "")},
                {"address", body.value("address", "")},
                {"items", body.value("items", json::array())},
                {"total", body.value("total", 0)},
                {"status", "PENDING"},
                {"createdAt", createdAt}
            };

            ordersStore.push_back(newOrder);
            saveDatabase();

            cout << "[ENQ] Don #" << orderId << " | Hang doi hien tai: "
                 << engine.xuLyLenh("SIZE") << endl;

            json responsePayload = {
                {"orderId", orderId},
                {"status", "PENDING"},
                {"createdAt", createdAt}
            };
            res.set_content(responsePayload.dump(), "application/json");
        } catch (const exception& e) {
            res.status = 400;
            res.set_content(json{{"error", e.what()}}.dump(), "application/json");
        }
    });

    // 3. API Tra cứu đơn theo SĐT: GET /api/orders?phone=... (khớp với getOrdersByPhone)
    svr.Get("/api/orders", [](const httplib::Request& req, httplib::Response& res) {
        lock_guard<mutex> lock(dataMutex);
        string phone = req.get_param_value("phone");
        json result = json::array();

        // Duyệt ngược để đơn mới nhất lên đầu
        for (int i = (int)ordersStore.size() - 1; i >= 0; --i) {
            if (ordersStore[i].value("phone", "") == phone) {
                result.push_back({
                    {"orderId", ordersStore[i]["orderId"]},
                    {"status", ordersStore[i]["status"]},
                    {"createdAt", ordersStore[i]["createdAt"]},
                    {"total", ordersStore[i]["total"]},
                    {"items", ordersStore[i]["items"]}
                });
            }
        }
        res.set_content(result.dump(), "application/json");
    });

    // 4. API Admin duyệt đơn tiếp theo (Dequeue FIFO): POST /api/orders/process-next
    svr.Post("/api/orders/process-next", [](const httplib::Request&, httplib::Response& res) {
        lock_guard<mutex> lock(dataMutex);
        string deqRes = engine.xuLyLenh("DEQ"); // Lấy mã đơn đầu hàng đợi ("ID 1001" hoặc "EMPTY")

        if (deqRes == "EMPTY") {
            res.status = 400;
            res.set_content(json{{"message", "Hang doi dang rong!"}}.dump(), "application/json");
            return;
        }

        int processedId = stoi(deqRes.substr(3)); // Cắt bỏ chữ "ID "
        for (auto& ord : ordersStore) {
            if (ord["orderId"] == processedId) {
                ord["status"] = "APPROVED";
                break;
            }
        }
        saveDatabase();

        cout << "[DEQ] Da duyet don #" << processedId << " | Con lai: "
             << engine.xuLyLenh("SIZE") << endl;

        res.set_content(json{
            {"message", "Da duyet don hang thanh cong"},
            {"orderId", processedId}
        }.dump(), "application/json");
    });

    cout << "BeautyStore C++ Server dang chay tai http://localhost:8080 ..." << endl;
    svr.listen("0.0.0.0", 8080);
    return 0;
}
