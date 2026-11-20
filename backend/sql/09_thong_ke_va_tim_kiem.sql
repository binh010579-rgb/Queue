-- Thống kê tổng số đơn và tổng giá trị
SELECT
  COUNT(*)                                                           AS tong_so_don,
  COALESCE(SUM(total_amount), 0)                                     AS tong_gia_tri,
  COALESCE(SUM(CASE WHEN status <> 'CANCELLED' THEN total_amount END), 0) AS gia_tri_hop_le
FROM orders;

-- Thống kê số đơn theo trạng thái
SELECT status, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien
FROM orders
GROUP BY status
ORDER BY status;

-- Tìm đơn theo ngày tạo
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status IN ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED')
  AND created_at >= '2026-11-11 00:00:00'
  AND created_at <  '2026-11-12 00:00:00'
ORDER BY created_at DESC, id DESC;

-- Xem đơn theo trạng thái
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status = 'CANCELLED'
ORDER BY created_at DESC, id DESC;
