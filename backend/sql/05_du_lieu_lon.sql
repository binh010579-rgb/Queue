-- Chỉ chạy trên database kiểm thử
DROP TEMPORARY TABLE IF EXISTS kiem_tra_database;
CREATE TEMPORARY TABLE kiem_tra_database (
  ten VARCHAR(64),
  CONSTRAINT chi_chay_tren_database_test CHECK (RIGHT(ten, 5) = '_test')
);
INSERT INTO kiem_tra_database VALUES (DATABASE());
DROP TEMPORARY TABLE kiem_tra_database;

-- Xóa đơn hàng cũ
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
SET FOREIGN_KEY_CHECKS = 1;

-- Thêm 200.000 đơn hàng
SET SESSION cte_max_recursion_depth = 200000;

INSERT INTO orders (order_code, customer_name, customer_phone, shipping_address, total_amount, status, created_at)
WITH RECURSIVE seq (n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 200000
)
SELECT
  CONCAT('BM-', LPAD(n, 8, '0')),
  CONCAT('Khách hàng ', n),
  CONCAT('09', LPAD(n, 8, '0')),
  'TP.HCM',
  100000 + MOD(n, 50) * 10000,
  CASE
    WHEN MOD(n * 37, 100) < 2  THEN 'PENDING'
    WHEN MOD(n * 37, 100) < 5  THEN 'APPROVED'
    WHEN MOD(n * 37, 100) < 15 THEN 'CANCELLED'
    ELSE 'COMPLETED'
  END,
  TIMESTAMP('2025-01-01 00:00:00') + INTERVAL ((n DIV 2) * 150) SECOND
FROM seq;

ANALYZE TABLE orders;

-- Kiểm tra số đơn theo trạng thái
SELECT status, COUNT(*) AS so_don
FROM orders
GROUP BY status
ORDER BY status;
