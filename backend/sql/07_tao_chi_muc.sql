-- Tạo chỉ mục tổng hợp (status, created_at, id)
SET @co_chi_muc = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name   = 'orders'
    AND index_name   = 'idx_orders_status_created_id'
);
SET @lenh = IF(@co_chi_muc = 0,
  'CREATE INDEX idx_orders_status_created_id ON orders (status, created_at, id)',
  'DO 0');
PREPARE stmt FROM @lenh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ANALYZE TABLE orders;

-- Danh sách chỉ mục hiện có
SHOW INDEX FROM orders;
