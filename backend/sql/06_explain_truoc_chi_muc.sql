-- Xóa chỉ mục nếu đã có
SET @co_chi_muc = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name   = 'orders'
    AND index_name   = 'idx_orders_status_created_id'
);
SET @lenh = IF(@co_chi_muc > 0,
  'DROP INDEX idx_orders_status_created_id ON orders',
  'DO 0');
PREPARE stmt FROM @lenh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ANALYZE TABLE orders;

-- Danh sách chỉ mục hiện có
SHOW INDEX FROM orders;

-- EXPLAIN truy vấn dựng lại hàng chờ
EXPLAIN
SELECT id
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;

-- EXPLAIN truy vấn danh sách PENDING
EXPLAIN
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;

-- EXPLAIN ANALYZE truy vấn dựng lại hàng chờ
EXPLAIN ANALYZE
SELECT id
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;
