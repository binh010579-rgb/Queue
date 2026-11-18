const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateCreateOrder, validatePhoneQuery } = require('../src/validators/orderValidator');

// Dữ liệu mẫu giống frontend gửi lên
function validBody(overrides = {}) {
  return {
    customerName: '  Nguyễn   Thị Lan ',
    phone: '0901 234 567',
    email: 'lan@example.com',
    address: '12 Lê Lợi, Q.1, TP.HCM',
    items: [
      { productId: 1, name: 'Sữa rửa mặt', price: 289000, quantity: 2 },
      { productId: '3', name: 'Tinh chất HA', price: 520000, quantity: '1' },
      { productId: 1, name: 'Sữa rửa mặt', price: 289000, quantity: 1 },
    ],
    total: 1387000,
    ...overrides,
  };
}

function getError(fn) {
  try {
    fn();
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    return err;
  }
  return assert.fail('Phải báo lỗi VALIDATION_ERROR');
}

function getErrorFields(fn) {
  return getError(fn).details.map((d) => d.field);
}

// Dữ liệu hợp lệ
describe('validateCreateOrder - dữ liệu hợp lệ', () => {
  it('chuẩn hóa thông tin khách hàng', () => {
    const result = validateCreateOrder(validBody());
    assert.deepEqual(result.customer, {
      name: 'Nguyễn Thị Lan',
      phone: '0901234567',
      email: 'lan@example.com',
      address: '12 Lê Lợi, Q.1, TP.HCM',
    });
  });

  it('gộp sản phẩm trùng và nhận id dạng chuỗi số', () => {
    const result = validateCreateOrder(validBody());
    assert.deepEqual(result.items, [
      { productId: 1, quantity: 3 },
      { productId: 3, quantity: 1 },
    ]);
  });

  it('không có email thì lưu null', () => {
    const body = validBody();
    delete body.email;
    assert.equal(validateCreateOrder(body).customer.email, null);
  });

  it('bỏ qua tên, giá, tổng tiền và trạng thái do client gửi lên', () => {
    const result = validateCreateOrder(validBody({ total: 1, status: 'APPROVED' }));
    assert.equal(result.total, undefined);
    assert.equal(result.status, undefined);
    assert.deepEqual(Object.keys(result.items[0]), ['productId', 'quantity']);
  });
});

// Dữ liệu không hợp lệ
describe('validateCreateOrder - dữ liệu không hợp lệ', () => {
  it('body rỗng hoặc null', () => {
    const fields = getErrorFields(() => validateCreateOrder(null));
    assert.ok(fields.includes('customerName'));
    assert.ok(fields.includes('items'));
  });

  it('message là lỗi đầu tiên để frontend hiển thị', () => {
    const err = getError(() => validateCreateOrder(validBody({ customerName: '' })));
    assert.equal(err.message, 'Họ tên phải từ 2 đến 100 ký tự');
  });

  it('thiếu sản phẩm', () => {
    assert.deepEqual(getErrorFields(() => validateCreateOrder(validBody({ items: [] }))), ['items']);
  });

  it('số điện thoại sai', () => {
    assert.deepEqual(getErrorFields(() => validateCreateOrder(validBody({ phone: '12345' }))), ['phone']);
  });

  it('email sai', () => {
    assert.deepEqual(getErrorFields(() => validateCreateOrder(validBody({ email: 'lan@' }))), ['email']);
  });

  it('địa chỉ quá ngắn', () => {
    assert.deepEqual(getErrorFields(() => validateCreateOrder(validBody({ address: 'Q1' }))), ['address']);
  });

  it('số lượng 0, số thập phân, quá 99', () => {
    const fields = getErrorFields(() => validateCreateOrder(validBody({
      items: [
        { productId: 1, quantity: 0 },
        { productId: 2, quantity: 1.5 },
        { productId: 3, quantity: 100 },
      ],
    })));
    assert.deepEqual(fields, ['items[0].quantity', 'items[1].quantity', 'items[2].quantity']);
  });

  it('mã sản phẩm âm hoặc không phải số', () => {
    const fields = getErrorFields(() => validateCreateOrder(validBody({
      items: [
        { productId: -1, quantity: 1 },
        { productId: 'abc', quantity: 1 },
      ],
    })));
    assert.deepEqual(fields, ['items[0].productId', 'items[1].productId']);
  });

  it('tổng số lượng sau khi gộp vượt quá 99', () => {
    const fields = getErrorFields(() => validateCreateOrder(validBody({
      items: [
        { productId: 1, quantity: 60 },
        { productId: 1, quantity: 60 },
      ],
    })));
    assert.deepEqual(fields, ['items']);
  });
});

// Số điện thoại tra cứu
describe('validatePhoneQuery', () => {
  it('chuẩn hóa số hợp lệ', () => {
    assert.equal(validatePhoneQuery(' 0901.000.004 '), '0901000004');
    assert.equal(validatePhoneQuery('+84901000004'), '+84901000004');
  });

  it('báo lỗi khi thiếu hoặc sai', () => {
    assert.deepEqual(getErrorFields(() => validatePhoneQuery(undefined)), ['phone']);
    assert.deepEqual(getErrorFields(() => validatePhoneQuery('abc')), ['phone']);
  });
});
