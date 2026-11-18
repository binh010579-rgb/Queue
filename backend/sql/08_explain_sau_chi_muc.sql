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
