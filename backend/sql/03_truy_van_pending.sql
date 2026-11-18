-- Lấy id đơn PENDING để dựng lại hàng chờ
SELECT id
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;

-- Lấy danh sách đơn PENDING kèm thông tin
SELECT id, order_code, customer_name, total_amount, status, created_at
FROM orders
WHERE status = 'PENDING'
ORDER BY created_at ASC, id ASC;
