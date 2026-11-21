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

// Khoảng ngày tạo đơn (định dạng YYYY-MM-DD), gửi lên backend để lọc
export type DateRange = { from?: string; to?: string };

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// 4. Lấy toàn bộ đơn (mới nhất trước), lọc theo trạng thái và ngày tạo ngay ở backend
export async function getAllOrders(
  status?: OrderStatus,
  range: DateRange = {},
): Promise<AdminOrder[]> {
  const query = buildQuery({ status, from: range.from, to: range.to });
  const response = await fetch(`${API_BASE_URL}/admin/orders${query}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Lỗi tải danh sách đơn: ${response.status}`));
  }
  return response.json();
}

// Thống kê do backend tính (GET /admin/stats)
export type OrderStats = {
  totalOrders: number;
  totalValue: number;
  validValue: number; // không tính đơn đã hủy
  byStatus: Record<OrderStatus, { count: number; value: number }>;
};

export async function getOrderStats(range: DateRange = {}): Promise<OrderStats> {
  const query = buildQuery({ from: range.from, to: range.to });
  const response = await fetch(`${API_BASE_URL}/admin/stats${query}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Lỗi tải thống kê: ${response.status}`));
  }
  return response.json();
}

// Xem chi tiết một đơn (GET /orders/:id)
export async function getOrderDetail(orderId: number): Promise<AdminOrder> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);
  if (!response.ok) {
    throw new Error(await readError(response, "Không tìm thấy đơn hàng."));
  }
  return response.json();
}

// Xóa đơn (backend chỉ cho xóa đơn đã hủy hoặc đã hoàn thành)
export async function deleteOrder(orderId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await readError(response, "Không thể xóa đơn này."));
  }
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
