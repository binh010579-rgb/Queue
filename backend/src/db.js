const mysql = require('mysql2/promise');

// Tạo pool kết nối MySQL
function createPool(overrides = {}) {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'beautystore',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    ...overrides,
  });
}

module.exports = { createPool };
