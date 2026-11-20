const ITEM_BATCH_SIZE = 1000;

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
  const rows = [];
  for (let i = 0; i < orderIds.length; i += ITEM_BATCH_SIZE) {
    const [batch] = await db.query(
      `SELECT oi.order_id, oi.product_id, p.name, oi.quantity, oi.unit_price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (?)
       ORDER BY oi.order_id, oi.id`,
      [orderIds.slice(i, i + ITEM_BATCH_SIZE)],
    );
    for (const row of batch) rows.push(row);
  }
  return rows;
}

// Điều kiện lọc theo trạng thái và ngày tạo
function buildFilterWhere(filter) {
  const conditions = ['status IN (?)'];
  const params = [filter.statuses];
  if (filter.from) {
    conditions.push('created_at >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('created_at < ?');
    params.push(filter.to);
  }
  return { where: conditions.join(' AND '), params };
}

// Lọc đơn theo trạng thái và ngày tạo
async function findOrders(db, filter) {
  const { where, params } = buildFilterWhere(filter);
  let sql = `
    SELECT id, order_code, customer_name, customer_phone, customer_email,
           shipping_address, total_amount, status, created_at
    FROM orders
    WHERE ${where}
    ORDER BY created_at DESC, id DESC`;
  if (filter.limit) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(filter.limit, filter.offset || 0);
  }
  const [rows] = await db.query(sql, params);
  return rows;
}

// Thống kê đơn theo trạng thái
async function getOrderStats(db, filter) {
  const { where, params } = buildFilterWhere(filter);
  const [rows] = await db.query(
    `SELECT status, COUNT(*) AS so_don, COALESCE(SUM(total_amount), 0) AS tong_tien
     FROM orders
     WHERE ${where}
     GROUP BY status`,
    params,
  );
  return rows;
}

// Xóa đơn đã hủy hoặc đã hoàn thành
async function deleteFinishedOrder(db, orderId) {
  const [result] = await db.execute(
    "DELETE FROM orders WHERE id = ? AND status IN ('CANCELLED', 'COMPLETED')",
    [orderId],
  );
  return result.affectedRows === 1;
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

// Cập nhật trạng thái có điều kiện: chỉ đổi khi đơn đang ở trạng thái "from".
// Trả true khi đúng 1 dòng bị thay đổi (chống xử lý trùng).
async function updateStatusIf(db, orderId, from, to) {
  const [result] = await db.execute(
    'UPDATE orders SET status = ? WHERE id = ? AND status = ?',
    [to, orderId, from],
  );
  return result.affectedRows === 1;
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
  findOrders,
  getOrderStats,
  deleteFinishedOrder,
  getPendingOrderIds,
  getPendingOrders,
  updateStatusIf,
};
