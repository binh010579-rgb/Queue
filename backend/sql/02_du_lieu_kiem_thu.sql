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

-- Thêm hoặc cập nhật sản phẩm
INSERT INTO products (id, name, price, is_active) VALUES
(1, 'Sữa rửa mặt dịu nhẹ Pure Clean',    289000, 1),
(2, 'Nước cân bằng Rose Balance',        345000, 1),
(3, 'Tinh chất HA Plump & Glow',         520000, 1),
(4, 'Kem dưỡng phục hồi Barrier Plus',   465000, 1),
(5, 'Kem chống nắng Airy Shield SPF50+', 390000, 1),
(6, 'Gel rửa mặt Matcha Fresh',          315000, 1),
(7, 'Serum Vitamin C Bright Drop',       595000, 1),
(8, 'Kem dưỡng Water Cream',             430000, 1),
(9, 'Phấn phủ kiềm dầu (ngừng bán)',     210000, 0) AS moi
ON DUPLICATE KEY UPDATE name = moi.name, price = moi.price, is_active = moi.is_active;

-- Thêm đơn hàng
INSERT INTO orders (id, order_code, customer_name, customer_phone, customer_email, shipping_address, total_amount, status, created_at) VALUES
( 1, 'BS-20261110-000001', 'Nguyễn Thị Lan',   '0901000001', 'lan@example.com',  'Q.1, TP.HCM',          578000, 'COMPLETED', '2026-11-10 08:00:00.000'),
( 2, 'BS-20261110-000002', 'Trần Minh Anh',    '0901000002', NULL,               'Q.3, TP.HCM',          345000, 'PENDING',   '2026-11-10 08:05:00.000'),
( 3, 'BS-20261110-000003', 'Lê Thu Hà',        '0901000003', 'ha@example.com',   'Q.Bình Thạnh, TP.HCM', 520000, 'CANCELLED', '2026-11-10 08:05:00.000'),
( 4, 'BS-20261110-000004', 'Phạm Ngọc Mai',    '0901000004', NULL,               'TP.Thủ Đức, TP.HCM',   855000, 'PENDING',   '2026-11-10 09:15:30.000'),
( 5, 'BS-20261110-000005', 'Võ Thanh Tâm',     '0901000005', 'tam@example.com',  'Q.7, TP.HCM',          289000, 'PENDING',   '2026-11-10 09:15:30.000'),
( 6, 'BS-20261110-000006', 'Đặng Hoàng Yến',   '0901000006', NULL,               'Q.10, TP.HCM',         690000, 'APPROVED',  '2026-11-10 09:15:30.000'),
( 7, 'BS-20261110-000007', 'Bùi Khánh Linh',   '0901000007', NULL,               'Q.Gò Vấp, TP.HCM',    1040000, 'PENDING',   '2026-11-10 10:00:00.250'),
( 8, 'BS-20261110-000008', 'Huỳnh Gia Hân',    '0901000008', 'han@example.com',  'Q.5, TP.HCM',         1170000, 'PENDING',   '2026-11-10 10:00:00.100'),
( 9, 'BS-20261110-000009', 'Ngô Bảo Trâm',     '0901000009', NULL,               'Q.Tân Bình, TP.HCM',   465000, 'PENDING',   '2026-11-10 07:30:00.000'),
(10, 'BS-20261111-000010', 'Dương Mỹ Duyên',   '0901000010', NULL,               'Q.4, TP.HCM',          634000, 'CANCELLED', '2026-11-11 08:00:00.000'),
(11, 'BS-20261111-000011', 'Lý Phương Thảo',   '0901000011', 'thao@example.com', 'Q.6, TP.HCM',          390000, 'PENDING',   '2026-11-11 08:00:00.000'),
(12, 'BS-20261111-000012', 'Hồ Ngọc Trinh',    '0901000012', NULL,               'Q.8, TP.HCM',          930000, 'COMPLETED', '2026-11-11 14:20:00.000'),
(13, 'BS-20261111-000013', 'Mai Thùy Dung',    '0901000013', NULL,               'Q.11, TP.HCM',         910000, 'PENDING',   '2026-11-11 14:20:00.000'),
(14, 'BS-20261111-000014', 'Tô Kim Ngân',      '0901000014', 'ngan@example.com', 'Q.12, TP.HCM',         345000, 'PENDING',   '2026-11-11 14:20:00.000'),
(15, 'BS-20261112-000015', 'Châu Tuyết Nhi',   '0901000015', NULL,               'Q.Phú Nhuận, TP.HCM',  867000, 'APPROVED',  '2026-11-12 09:00:00.000'),
(16, 'BS-20261112-000016', 'Quách Diễm My',    '0901000016', NULL,               'Q.Tân Phú, TP.HCM',    985000, 'PENDING',   '2026-11-12 09:00:00.000');

-- Thêm chi tiết đơn hàng
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
( 1, 1, 2, 289000),
( 2, 2, 1, 345000),
( 3, 3, 1, 520000),
( 4, 4, 1, 465000), ( 4, 5, 1, 390000),
( 5, 1, 1, 289000),
( 6, 2, 2, 345000),
( 7, 3, 2, 520000),
( 8, 5, 3, 390000),
( 9, 4, 1, 465000),
(10, 1, 1, 289000), (10, 2, 1, 345000),
(11, 5, 1, 390000),
(12, 4, 2, 465000),
(13, 3, 1, 520000), (13, 5, 1, 390000),
(14, 2, 1, 345000),
(15, 1, 3, 289000),
(16, 4, 1, 465000), (16, 3, 1, 520000);

ANALYZE TABLE orders;
