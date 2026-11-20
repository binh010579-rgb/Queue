// [TV5 - CẬP NHẬT] Bổ sung hook `useMemo` để tối ưu tính toán thống kê và bộ lọc
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelOrder,
  completeOrder,
  getAllOrders,
  processNextOrder,
  type AdminOrder,
  type OrderStatus,
} from "../api";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

const formatTime = (iso: string) => new Date(iso).toLocaleString("vi-VN");

// [TV5 - THÊM MỚI] Hàm chuẩn hóa thời gian tạo đơn sang YYYY-MM-DD theo múi giờ máy (tránh lệch ngày UTC)
const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const statusDetails: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: "Chờ xử lý", className: "bg-[#fff3cd] text-[#8a6512]" },
  APPROVED: { label: "Đã duyệt", className: "bg-[#dff5e8] text-[#29704b]" },
  COMPLETED: { label: "Hoàn thành", className: "bg-[#dfeeff] text-[#28639b]" },
  CANCELLED: { label: "Đã hủy", className: "bg-[#f1e4e8] text-[#92566a]" },
};

const filters: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
];

export default function Admin() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("PENDING");
  // [TV5 - THÊM MỚI] State lưu ngày tạo cần lọc (YYYY-MM-DD) và từ khóa tìm kiếm nhanh
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await getAllOrders());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách đơn.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải khi mở trang và tự làm mới mỗi 5 giây
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Chạy một thao tác (duyệt / hủy / hoàn thành) rồi tải lại danh sách
  const run = async (action: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      setNotice(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
      await load();
    }
  };

  const handleProcessNext = () =>
    run(async () => {
      const res = await processNextOrder();
      const skipped = res.skipped ? ` (bỏ qua ${res.skipped} đơn đã hủy)` : "";
      return `Đã duyệt đơn #${res.orderId}${skipped}`;
    });

  const handleCancel = (id: number) =>
    run(async () => {
      await cancelOrder(id);
      return `Đã hủy đơn #${id}`;
    });

  const handleComplete = (id: number) =>
    run(async () => {
      await completeOrder(id);
      return `Đơn #${id} đã hoàn thành`;
    });

  // [TV5 - THÊM MỚI] Bước 1: Lọc danh sách đơn theo ngày tạo (nếu người dùng có chọn ngày)
  const ordersByDate = useMemo(() => {
    if (!dateFilter) return orders;
    return orders.filter((o) => toLocalDateKey(o.createdAt) === dateFilter);
  }, [orders, dateFilter]);

  // [TV5 - THÊM MỚI] Bước 2: Thống kê tổng số đơn, tổng giá trị và số đơn theo từng trạng thái
  const stats = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    let totalValue = 0;
    let validValue = 0; // Tổng doanh thu các đơn hợp lệ (không tính đơn đã hủy)

    for (const o of ordersByDate) {
      counts[o.status] += 1;
      const amount = Number(o.total) || 0;
      totalValue += amount;
      if (o.status !== "CANCELLED") {
        validValue += amount;
      }
    }

    return {
      totalOrders: ordersByDate.length,
      totalValue,
      validValue,
      counts,
    };
  }, [ordersByDate]);

  // [TV5 - CẬP NHẬT] Thứ tự hàng chờ FIFO toàn cục (tính từ toàn bộ orders để luôn khớp với C++ Engine)
  const queueOrder = useMemo(
    () =>
      orders
        .filter((o) => o.status === "PENDING")
        .sort((x, y) => x.orderId - y.orderId)
        .map((o) => o.orderId),
    [orders],
  );

  // [TV5 - CẬP NHẬT] Kết hợp lọc ngày + lọc trạng thái + tìm nhanh mã đơn/tên/SĐT, giữ thứ tự FIFO
  const shown = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase().replace(/^#/, "");
    return ordersByDate
      .filter((o) => (filter === "ALL" ? true : o.status === filter))
      .filter((o) => {
        if (!keyword) return true;
        return (
          String(o.orderId).includes(keyword) ||
          (o.customerName || "").toLowerCase().includes(keyword) ||
          (o.phone || "").includes(keyword)
        );
      })
      .slice()
      .sort((x, y) => x.orderId - y.orderId);
  }, [ordersByDate, filter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#fff9fa] text-[#30292c]">
      <header className="border-b border-[#f3e4e8] bg-white">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
          <h1 className="font-serif text-xl font-semibold sm:text-2xl">
            Beauty<span className="text-[#ff5e81]">Store</span> · Admin
          </h1>
          <a href="#/" className="text-sm font-medium text-[#ff5e81] hover:underline">
            ← Về cửa hàng
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Quản lý đơn hàng</h2>
            {/* [TV5 - CẬP NHẬT] Hiển thị số đơn dựa trên kết quả thống kê và ngày đang lọc (nếu có) */}
            <p className="mt-1 text-sm text-[#7a6b70]">
              {stats.counts.PENDING} đơn đang chờ xử lý · tổng {stats.totalOrders} đơn
              {dateFilter ? ` (ngày ${dateFilter.split("-").reverse().join("/")})` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-full border border-[#eadadd] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
            <button
              onClick={handleProcessNext}
              disabled={busy}
              className="rounded-full bg-[#29704b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Xử lý đơn tiếp theo
            </button>
          </div>
        </div>

        {/* [TV5 - THÊM MỚI] Khu vực 6 thẻ thống kê: Tổng số đơn, Tổng giá trị & Số đơn theo từng trạng thái */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#7a6b70]">Tổng số đơn</p>
            <p className="mt-1 text-2xl font-bold text-[#30292c]">{stats.totalOrders}</p>
          </div>
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#7a6b70]">Tổng giá trị (hợp lệ)</p>
            <p className="mt-1 text-lg font-bold text-[#e84f70]">{formatPrice(stats.validValue)}</p>
            <p className="mt-0.5 text-[11px] text-[#9a898e]">
              Gồm đơn hủy: {formatPrice(stats.totalValue)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#8a6512]">Chờ xử lý</p>
            <p className="mt-1 text-2xl font-bold text-[#8a6512]">{stats.counts.PENDING}</p>
          </div>
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#29704b]">Đã duyệt</p>
            <p className="mt-1 text-2xl font-bold text-[#29704b]">{stats.counts.APPROVED}</p>
          </div>
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#28639b]">Hoàn thành</p>
            <p className="mt-1 text-2xl font-bold text-[#28639b]">{stats.counts.COMPLETED}</p>
          </div>
          <div className="rounded-2xl border border-[#f3e4e8] bg-white p-4">
            <p className="text-xs font-medium text-[#92566a]">Đã hủy</p>
            <p className="mt-1 text-2xl font-bold text-[#92566a]">{stats.counts.CANCELLED}</p>
          </div>
        </section>

        {notice && (
          <p className="mt-4 rounded-xl bg-[#dff5e8] px-4 py-3 text-sm text-[#29704b]">{notice}</p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-[#f1e4e8] px-4 py-3 text-sm text-[#92566a]">{error}</p>
        )}

        {/* [TV5 - CẬP NHẬT] Thanh lọc kết hợp: Lọc theo trạng thái + Tìm đơn theo ngày tạo + Tìm nhanh */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={
                  "rounded-full border px-4 py-1.5 text-sm font-medium " +
                  (filter === f.value
                    ? "border-[#ff6b8b] bg-[#ff6b8b] text-white"
                    : "border-[#eadadd] bg-white hover:border-[#ff9eb3]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* [TV5 - THÊM MỚI] Bộ lọc tìm đơn theo ngày tạo & ô tìm kiếm mã đơn / SĐT */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-full border border-[#eadadd] bg-white px-4 py-1.5 text-sm">
              <span className="text-xs font-medium text-[#7a6b70]">Ngày tạo:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-sm outline-none"
              />
            </label>
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="rounded-full border border-[#eadadd] bg-white px-3 py-1.5 text-xs font-semibold text-[#7a6b70] hover:border-[#ff9eb3] hover:text-[#ff5e81]"
              >
                Xóa ngày
              </button>
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã đơn, tên, SĐT..."
              className="rounded-full border border-[#eadadd] bg-white px-4 py-1.5 text-sm outline-none focus:border-[#ff8ca5]"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-[#f3e4e8] bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#fff3f6] text-[#7a6b70]">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Tổng tiền</th>
                <th className="px-4 py-3">Thời gian tạo</th>
                <th className="px-4 py-3">Lượt xử lý</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#7a6b70]">
                    Không có đơn nào.
                  </td>
                </tr>
              )}
              {shown.map((o) => (
                <tr key={o.orderId} className="border-t border-[#f3e4e8] align-top">
                  <td className="px-4 py-3 font-semibold">#{o.orderId}</td>
                  <td className="px-4 py-3">
                    <div>{o.customerName || "—"}</div>
                    <div className="text-xs text-[#7a6b70]">{o.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {o.items.length === 0
                      ? "—"
                      : o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ")}
                  </td>
                  <td className="px-4 py-3">{formatPrice(o.total)}</td>
                  <td className="px-4 py-3">{formatTime(o.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {o.status === "PENDING"
                      ? queueOrder.indexOf(o.orderId) === 0
                        ? "Kế tiếp ▶"
                        : `Lượt ${queueOrder.indexOf(o.orderId) + 1}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-3 py-1 text-xs font-semibold " +
                        statusDetails[o.status].className
                      }
                    >
                      {statusDetails[o.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.status === "PENDING" && queueOrder[0] === o.orderId && (
                      <button
                        onClick={handleProcessNext}
                        disabled={busy}
                        className="mr-2 rounded-full bg-[#29704b] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Duyệt
                      </button>
                    )}
                    {o.status === "PENDING" && (
                      <button
                        onClick={() => handleCancel(o.orderId)}
                        disabled={busy}
                        className="rounded-full border border-[#92566a] px-3 py-1 text-xs font-semibold text-[#92566a] disabled:opacity-50"
                      >
                        Hủy đơn
                      </button>
                    )}
                    {o.status === "APPROVED" && (
                      <button
                        onClick={() => handleComplete(o.orderId)}
                        disabled={busy}
                        className="rounded-full border border-[#28639b] px-3 py-1 text-xs font-semibold text-[#28639b] disabled:opacity-50"
                      >
                        Hoàn thành
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}