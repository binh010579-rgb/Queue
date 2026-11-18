export type OrderStatus = "PENDING" | "APPROVED" | "COMPLETED" | "CANCELLED";

export type OrderLine = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  orderId: number;
  status: OrderStatus;
  createdAt: string;
  total: number;
  items: OrderLine[];
};

// Đơn đầy đủ thông tin khách, chỉ dùng cho trang Admin
export type AdminOrder = Order & {
  customerName: string;
  phone: string;
  address: string;
};

export type NewOrder = {
  customerName: string;
  phone: string;
  address: string;
  items: OrderLine[];
  total: number;
};

// Địa chỉ server C++. Có thể đổi bằng biến môi trường VITE_API_URL (file .env)
const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080/api";

export const normalizePhone = (phone: string) => phone.replace(/[\s.-]/g, "");

export const isValidPhone = (phone: string) => /^0\d{9}$/.test(normalizePhone(phone));

// Đọc thông báo lỗi từ server (nếu có), không thì dùng câu mặc định
async function readError(response: Response, fallback: string): Promise<string> {
  const err = await response.json().catch(() => ({}));
  return err.message || err.error || fallback;
}

// 1. Gửi đơn hàng mới xuống C++ (Đưa vào Queue)
export async function createOrder(
  order: NewOrder,
): Promise<Pick<Order, "orderId" | "status" | "createdAt">> {
  const payload = {
    ...order,
    phone: normalizePhone(order.phone),
  };

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Lỗi tạo đơn hàng: ${response.status}`);
  }

  // Server C++ trả về JSON có dạng: { "orderId": 1001, "status": "PENDING", "createdAt": "..." }
  return response.json();
}

// 2. Tra cứu đơn hàng theo số điện thoại từ C++
export async function getOrdersByPhone(phone: string): Promise<Order[]> {
  const normalizedPhone = normalizePhone(phone);

  const response = await fetch(
    `${API_BASE_URL}/orders?phone=${encodeURIComponent(normalizedPhone)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Lỗi tra cứu đơn hàng: ${response.status}`);
  }

  // Server C++ trả về mảng JSON các đơn hàng: Order[]
  return response.json();
}

// ---------- Các hàm cho trang Admin ----------

// 3. Duyệt đơn tiếp theo. Server tự bỏ qua các đơn đã hủy; "skipped" là số đơn bị bỏ qua.
export async function processNextOrder(): Promise<{
  message: string;
  orderId?: number;
  skipped?: number;
}> {
  const response = await fetch(`${API_BASE_URL}/orders/process-next`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Hàng đợi đang rỗng!"));
  }
  return response.json();
}

// 4. Lấy toàn bộ đơn (mới nhất trước), có thể lọc theo trạng thái
export async function getAllOrders(status?: OrderStatus): Promise<AdminOrder[]> {
  const query = status ? `?status=${status}` : "";
  const response = await fetch(`${API_BASE_URL}/admin/orders${query}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Lỗi tải danh sách đơn: ${response.status}`));
  }
  return response.json();
}

// 5. Hủy đơn (chỉ đơn PENDING)
export async function cancelOrder(orderId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await readError(response, "Không thể hủy đơn này."));
  }
}

// 6. Hoàn thành đơn (chỉ đơn APPROVED)
export async function completeOrder(orderId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/complete`, { method: "POST" });
  if (!response.ok) {
    throw new Error(await readError(response, "Không thể hoàn thành đơn này."));
  }
}
