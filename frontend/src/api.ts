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

export type NewOrder = {
  customerName: string;
  phone: string;
  address: string;
  items: OrderLine[];
  total: number;
};

// Địa chỉ server C++ của bạn
const API_BASE_URL = "http://127.0.0.1:8080/api";

export const normalizePhone = (phone: string) => phone.replace(/[\s.-]/g, "");

export const isValidPhone = (phone: string) => /^0\d{9}$/.test(normalizePhone(phone));

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

  // Server C++ cần trả về JSON có dạng: { "orderId": 1001, "status": "PENDING", "createdAt": "..." }
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

  // Server C++ cần trả về mảng JSON các đơn hàng: Order[]
  return response.json();
}
export async function processNextOrder(): Promise<{ message: string; orderId?: number }> {
  const response = await fetch(`${API_BASE_URL}/orders/process-next`, {
    method: "POST",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Hàng đợi đang rỗng!");
  }
  return response.json();
}
