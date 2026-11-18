-- Tạo bảng products
CREATE TABLE IF NOT EXISTS products (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name       VARCHAR(200)  NOT NULL,
  price      DECIMAL(12,2) NOT NULL,
  is_active  TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT chk_products_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tạo bảng orders
CREATE TABLE IF NOT EXISTS orders (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_code        VARCHAR(30)   NOT NULL,
  customer_name     VARCHAR(100)  NOT NULL,
  customer_phone    VARCHAR(20)   NOT NULL,
  customer_email    VARCHAR(150)  NULL,
  shipping_address  VARCHAR(255)  NOT NULL,
  total_amount      DECIMAL(14,2) NOT NULL,
  status            ENUM('PENDING','APPROVED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_code (order_code),
  KEY idx_orders_phone_created (customer_phone, created_at, id),
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tạo bảng order_items
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  quantity    INT UNSIGNED  NOT NULL,
  unit_price  DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm sản phẩm của frontend
INSERT INTO products (id, name, price, is_active) VALUES
(1, 'Sữa rửa mặt dịu nhẹ Pure Clean',    289000, 1),
(2, 'Nước cân bằng Rose Balance',        345000, 1),
(3, 'Tinh chất HA Plump & Glow',         520000, 1),
(4, 'Kem dưỡng phục hồi Barrier Plus',   465000, 1),
(5, 'Kem chống nắng Airy Shield SPF50+', 390000, 1),
(6, 'Gel rửa mặt Matcha Fresh',          315000, 1),
(7, 'Serum Vitamin C Bright Drop',       595000, 1),
(8, 'Kem dưỡng Water Cream',             430000, 1) AS moi
ON DUPLICATE KEY UPDATE name = moi.name, price = moi.price, is_active = moi.is_active;
