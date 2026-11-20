const crypto = require('crypto');
const { AppError } = require('../errors');
const repo = require('../repositories/orderRepository');
const {
  validateCreateOrder,
  validatePhoneQuery,
  validateOrderFilter,
  ORDER_STATUSES,
} = require('../validators/orderValidator');

const MAX_CODE_ATTEMPTS = 3;

// Hàm hỗ trợ
function generateOrderCode(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BS-${y}${m}${d}-${random}`;
}

function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function isOrderCodeConflict(err) {
  return err && err.code === 'ER_DUP_ENTRY' && String(err.message).includes('uq_orders_order_code');
}

function groupItemsByOrder(itemRows) {
  const map = new Map();
  for (const item of itemRows) {
    if (!map.has(item.order_id)) map.set(item.order_id, []);
    map.get(item.order_id).push(item);
  }
  return map;
}

// Định dạng dữ liệu trả về
function formatItems(items) {
  return items.map((item) => ({
    productId: item.product_id,
    name: item.name,
    price: item.unit_price,
    quantity: item.quantity,
  }));
}

function formatOrder(row, items) {
  return {
    orderId: row.id,
    orderCode: row.order_code,
    status: row.status,
    customerName: row.customer_name,
    phone: row.customer_phone,
    email: row.customer_email,
    address: row.shipping_address,
    total: row.total_amount,
    createdAt: toIso(row.created_at),
    items: formatItems(items),
  };
}

function formatHistoryOrder(row, items) {
  return {
    orderId: row.id,
    orderCode: row.order_code,
    status: row.status,
    createdAt: toIso(row.created_at),
    total: row.total_amount,
    items: formatItems(items),
  };
}

function formatPendingOrder(row) {
  return {
    orderId: row.id,
    orderCode: row.order_code,
    customerName: row.customer_name,
    total: row.total_amount,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

function createOrderService({ pool, queue, logger = console }) {
  // Lưu đơn với mã đơn không trùng
  async function insertOrderWithUniqueCode(conn, order) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await repo.insertOrder(conn, { ...order, orderCode: generateOrderCode() });
      } catch (err) {
        if (!isOrderCodeConflict(err) || attempt >= MAX_CODE_ATTEMPTS) throw err;
      }
    }
  }

  // Đưa đơn vào hàng chờ
  async function enqueueSafely(orderId) {
    try {
      await queue.enqueue(orderId);
      return true;
    } catch (err) {
      logger.warn(`[queue] ENQ ${orderId} thất bại: ${err.message}`);
      return false;
    }
  }

  // Lấy chi tiết đơn
  async function getOrderDetail(orderId) {
    const row = await repo.findOrderById(pool, orderId);
    if (!row) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
    const items = await repo.findItemsByOrderIds(pool, [orderId]);
    return formatOrder(row, items);
  }

  // Tạo đơn hàng
  async function createOrder(body) {
    const input = validateCreateOrder(body);
    const conn = await pool.getConnection();
    let orderId;

    try {
      await conn.beginTransaction();

      // Lấy giá sản phẩm từ Database
      const productIds = input.items.map((item) => item.productId);
      const products = await repo.findActiveProductsByIds(conn, productIds);
      const productMap = new Map(products.map((p) => [p.id, p]));
      const missing = productIds.filter((id) => !productMap.has(id));
      if (missing.length > 0) {
        throw new AppError(422, 'PRODUCT_NOT_AVAILABLE',
          'Có sản phẩm không tồn tại hoặc đã ngừng bán', { productIds: missing });
      }

      // Tính tổng tiền
      const lines = input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: productMap.get(item.productId).price,
      }));
      const totalCents = lines.reduce((sum, line) => sum + toCents(line.unitPrice) * line.quantity, 0);

      // Lưu đơn và chi tiết đơn
      orderId = await insertOrderWithUniqueCode(conn, {
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email,
        shippingAddress: input.customer.address,
        totalAmount: (totalCents / 100).toFixed(2),
      });
      await repo.insertOrderItems(conn, orderId, lines);

      await conn.commit();
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }

    await enqueueSafely(orderId);
    return getOrderDetail(orderId);
  }

  // Tra cứu đơn theo số điện thoại
  async function getOrdersByPhone(phoneQuery) {
    const phone = validatePhoneQuery(phoneQuery);
    const rows = await repo.findOrdersByPhone(pool, phone);
    const itemRows = await repo.findItemsByOrderIds(pool, rows.map((row) => row.id));
    const itemsByOrder = groupItemsByOrder(itemRows);
    return rows.map((row) => formatHistoryOrder(row, itemsByOrder.get(row.id) || []));
  }

  // Lọc đơn theo trạng thái và ngày tạo
  async function listOrders(query) {
    const filter = validateOrderFilter(query, { paging: true });
    const rows = await repo.findOrders(pool, filter);
    const itemRows = await repo.findItemsByOrderIds(pool, rows.map((row) => row.id));
    const itemsByOrder = groupItemsByOrder(itemRows);
    return rows.map((row) => formatOrder(row, itemsByOrder.get(row.id) || []));
  }

  // Thống kê đơn hàng
  async function getOrderStats(query) {
    const filter = validateOrderFilter(query);
    const rows = await repo.getOrderStats(pool, filter);
    const byStatus = {};
    for (const status of ORDER_STATUSES) byStatus[status] = { count: 0, value: 0 };

    let totalOrders = 0;
    let totalCents = 0;
    for (const row of rows) {
      const count = Number(row.so_don);
      const cents = toCents(row.tong_tien);
      byStatus[row.status] = { count, value: cents / 100 };
      totalOrders += count;
      totalCents += cents;
    }
    const cancelledCents = toCents(byStatus.CANCELLED.value);

    return {
      totalOrders,
      totalValue: totalCents / 100,
      validValue: (totalCents - cancelledCents) / 100,
      byStatus,
    };
  }

  // Xóa đơn đã hủy hoặc đã hoàn thành
  async function deleteOrder(orderId) {
    if (await repo.deleteFinishedOrder(pool, orderId)) {
      return { orderId, message: 'Đã xóa đơn hàng' };
    }
    const row = await repo.findOrderById(pool, orderId);
    if (!row) throw new AppError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng');
    throw new AppError(409, 'ORDER_NOT_DELETABLE',
      'Chỉ xóa được đơn đã hủy hoặc đã hoàn thành', { status: row.status });
  }

  // Danh sách đơn PENDING
  async function getPendingOrders() {
    const rows = await repo.getPendingOrders(pool);
    return rows.map(formatPendingOrder);
  }

  // Danh sách id PENDING để dựng lại hàng chờ
  function getPendingOrderIdsForRebuild() {
    return repo.getPendingOrderIds(pool);
  }

  return {
    createOrder,
    getOrderDetail,
    getOrdersByPhone,
    listOrders,
    getOrderStats,
    deleteOrder,
    getPendingOrders,
    getPendingOrderIdsForRebuild,
  };
}

module.exports = { createOrderService, generateOrderCode };
