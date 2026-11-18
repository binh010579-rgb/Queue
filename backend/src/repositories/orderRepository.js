// Truy vấn lọc và sắp xếp đơn PENDING
const SQL_PENDING_IDS = `
  SELECT id
  FROM orders
  WHERE status = 'PENDING'
  ORDER BY created_at ASC, id ASC`;

const SQL_PENDING_ORDERS = `
  SELECT id, order_code, customer_name, total_amount, status, created_at
  FROM orders
  WHERE status = 'PENDING'
  ORDER BY created_at ASC, id ASC`;

// Sản phẩm
async function findActiveProductsByIds(db, productIds) {
  const [rows] = await db.query(
    'SELECT id, name, price FROM products WHERE is_active = 1 AND id IN (?)',
    [productIds],
  );
  return rows;
}

// Thêm đơn hàng
async function insertOrder(db, order) {
  const [result] = await db.execute(
    `INSERT INTO orders
       (order_code, customer_name, customer_phone, customer_email, shipping_address, total_amount, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      order.orderCode,
      order.customerName,
      order.customerPhone,
      order.customerEmail,
      order.shippingAddress,
      order.totalAmount,
    ],
  );
  return result.insertId;
}

// Thêm chi tiết đơn hàng
async function insertOrderItems(db, orderId, lines) {
  const values = lines.map((line) => [orderId, line.productId, line.quantity, line.unitPrice]);
  await db.query(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ?',
    [values],
  );
}

// Lấy đơn hàng theo id
async function findOrderById(db, orderId) {
  const [rows] = await db.execute(
    `SELECT id, order_code, customer_name, customer_phone, customer_email,
            shipping_address, total_amount, status, created_at
     FROM orders
     WHERE id = ?`,
    [orderId],
  );
  return rows[0] || null;
}

// Lấy đơn hàng theo số điện thoại
async function findOrdersByPhone(db, phone) {
  const [rows] = await db.execute(
    `SELECT id, order_code, total_amount, status, created_at
     FROM orders
     WHERE customer_phone = ?
     ORDER BY created_at DESC, id DESC`,
    [phone],
  );
  return rows;
}

// Lấy chi tiết của nhiều đơn
async function findItemsByOrderIds(db, orderIds) {
  if (orderIds.length === 0) return [];
  const [rows] = await db.query(
    `SELECT oi.order_id, oi.product_id, p.name, oi.quantity, oi.unit_price
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id IN (?)
     ORDER BY oi.order_id, oi.id`,
    [orderIds],
  );
  return rows;
}

// Lấy đơn PENDING
async function getPendingOrderIds(db) {
  const [rows] = await db.query(SQL_PENDING_IDS);
  return rows.map((row) => row.id);
}

async function getPendingOrders(db) {
  const [rows] = await db.query(SQL_PENDING_ORDERS);
  return rows;
}

module.exports = {
  SQL_PENDING_IDS,
  SQL_PENDING_ORDERS,
  findActiveProductsByIds,
  insertOrder,
  insertOrderItems,
  findOrderById,
  findOrdersByPhone,
  findItemsByOrderIds,
  getPendingOrderIds,
  getPendingOrders,
};
