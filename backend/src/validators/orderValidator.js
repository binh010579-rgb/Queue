const { AppError } = require('../errors');

const PHONE_REGEX = /^(0|\+84)\d{9,10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

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

module.exports = { validateCreateOrder, validatePhoneQuery, normalizePhone, MAX_ITEMS, MAX_QUANTITY };
