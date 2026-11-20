-- EXPLAIN tìm đơn theo ngày tạo
EXPLAIN
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status IN ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED')
  AND created_at >= '2025-03-01 00:00:00'
  AND created_at <  '2025-03-02 00:00:00'
ORDER BY created_at DESC, id DESC;

-- EXPLAIN ANALYZE tìm đơn theo ngày tạo
EXPLAIN ANALYZE
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status IN ('PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED')
  AND created_at >= '2025-03-01 00:00:00'
  AND created_at <  '2025-03-02 00:00:00'
ORDER BY created_at DESC, id DESC;

-- EXPLAIN xem đơn theo trạng thái
EXPLAIN
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status = 'CANCELLED'
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- EXPLAIN thống kê theo trạng thái
EXPLAIN
SELECT status, COUNT(*) AS so_don, SUM(total_amount) AS tong_tien
FROM orders
GROUP BY status;
