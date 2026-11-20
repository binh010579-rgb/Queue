const { AppError } = require('../errors');

const PHONE_REGEX = /^(0|\+84)\d{9,10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'];
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const MAX_PAGE_SIZE = 1000;

// Hàm hỗ trợ
function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizePhone(value) {
  return cleanText(value).replace(/[\s.-]/g, '');
}

function toPositiveInt(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const number = Number(value.trim());
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }
  return null;
}

// Kiểm tra dữ liệu tạo đơn
function validateCreateOrder(body) {
  const errors = [];
  const data = body && typeof body === 'object' ? body : {};

  // Thông tin khách hàng
  const customerName = cleanText(data.customerName);
  const phone = normalizePhone(data.phone);
  const email = cleanText(data.email);
  const address = cleanText(data.address);

  if (customerName.length < 2 || customerName.length > 100) {
    errors.push({ field: 'customerName', message: 'Họ tên phải từ 2 đến 100 ký tự' });
  }
  if (!PHONE_REGEX.test(phone)) {
    errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ' });
  }
  if (email && (email.length > 150 || !EMAIL_REGEX.test(email))) {
    errors.push({ field: 'email', message: 'Email không hợp lệ' });
  }
  if (address.length < 5 || address.length > 255) {
    errors.push({ field: 'address', message: 'Địa chỉ phải từ 5 đến 255 ký tự' });
  }

  // Danh sách sản phẩm
  const quantities = new Map();
  const rawItems = data.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    errors.push({ field: 'items', message: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
  } else if (rawItems.length > MAX_ITEMS) {
    errors.push({ field: 'items', message: `Đơn hàng tối đa ${MAX_ITEMS} dòng sản phẩm` });
  } else {
    rawItems.forEach((item, index) => {
      const productId = toPositiveInt(item ? item.productId : undefined);
      const quantity = toPositiveInt(item ? item.quantity : undefined);

      if (productId === null) {
        errors.push({ field: `items[${index}].productId`, message: 'Mã sản phẩm không hợp lệ' });
        return;
      }
      if (quantity === null || quantity > MAX_QUANTITY) {
        errors.push({ field: `items[${index}].quantity`, message: `Số lượng phải là số nguyên từ 1 đến ${MAX_QUANTITY}` });
        return;
      }
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    });

    for (const [productId, quantity] of quantities) {
      if (quantity > MAX_QUANTITY) {
        errors.push({ field: 'items', message: `Tổng số lượng sản phẩm ${productId} vượt quá ${MAX_QUANTITY}` });
      }
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', errors[0].message, errors);
  }

  return {
    customer: { name: customerName, phone, email: email || null, address },
    items: [...quantities].map(([productId, quantity]) => ({ productId, quantity })),
  };
}

// Kiểm tra số điện thoại tra cứu
function validatePhoneQuery(value) {
  const phone = normalizePhone(value);
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Số điện thoại không hợp lệ',
      [{ field: 'phone', message: 'Số điện thoại không hợp lệ' }]);
  }
  return phone;
}

// Hàm hỗ trợ ngày và số trang
function parseDate(value) {
  if (typeof value !== 'string' || !DATE_REGEX.test(value.trim())) return null;
  const [y, m, d] = value.trim().split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isRealDate = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return isRealDate ? date : null;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function toNonNegativeInt(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) ? number : null;
}

// Kiểm tra bộ lọc đơn hàng
function validateOrderFilter(query, { paging = false } = {}) {
  const errors = [];
  const q = query && typeof query === 'object' ? query : {};
  const filter = { statuses: ORDER_STATUSES, from: null, to: null };

  if (!isMissing(q.status)) {
    const status = String(q.status).trim().toUpperCase();
    if (ORDER_STATUSES.includes(status)) {
      filter.statuses = [status];
    } else {
      errors.push({ field: 'status', message: `Trạng thái phải là ${ORDER_STATUSES.join(', ')}` });
    }
  }

  const fromDate = isMissing(q.from) ? null : parseDate(String(q.from));
  const toDate = isMissing(q.to) ? null : parseDate(String(q.to));
  if (!isMissing(q.from) && !fromDate) {
    errors.push({ field: 'from', message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD' });
  }
  if (!isMissing(q.to) && !toDate) {
    errors.push({ field: 'to', message: 'Ngày kết thúc phải có dạng YYYY-MM-DD' });
  }
  if (fromDate && toDate && fromDate > toDate) {
    errors.push({ field: 'to', message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu' });
  }
  if (fromDate) filter.from = `${formatDate(fromDate)} 00:00:00`;
  if (toDate) {
    const nextDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    filter.to = `${formatDate(nextDay)} 00:00:00`;
  }

  if (paging) {
    filter.limit = null;
    filter.offset = 0;
    if (!isMissing(q.limit)) {
      const limit = toNonNegativeInt(String(q.limit));
      if (limit === null || limit < 1 || limit > MAX_PAGE_SIZE) {
        errors.push({ field: 'limit', message: `limit phải là số nguyên từ 1 đến ${MAX_PAGE_SIZE}` });
      } else {
        filter.limit = limit;
      }
    }
    if (!isMissing(q.offset)) {
      const offset = toNonNegativeInt(String(q.offset));
      if (offset === null) {
        errors.push({ field: 'offset', message: 'offset phải là số nguyên không âm' });
      } else if (isMissing(q.limit)) {
        errors.push({ field: 'offset', message: 'offset phải đi kèm limit' });
      } else {
        filter.offset = offset;
      }
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', errors[0].message, errors);
  }
  return filter;
}

module.exports = {
  validateCreateOrder,
  validatePhoneQuery,
  validateOrderFilter,
  normalizePhone,
  ORDER_STATUSES,
  MAX_ITEMS,
  MAX_QUANTITY,
  MAX_PAGE_SIZE,
};
