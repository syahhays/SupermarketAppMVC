// models/Order.js
const db = require('../db');

const Order = {
  create: (userId, totalAmount, paymentMethod, status, callback) => {
    const sql = `
      INSERT INTO orders (userId, totalAmount, payment_method, status)
      VALUES (?, ?, ?, ?)
    `;
    db.query(sql, [userId, totalAmount, paymentMethod || null, status || 'PENDING'], callback);
  },

  updateStatus: (orderId, status, callback) => {
    const sql = `
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `;
    db.query(sql, [status, orderId], callback);
  },

  getAllByUser: (userId, callback) => {
    const sql = `
      SELECT * FROM orders
      WHERE userId = ?
      ORDER BY orderDate DESC
    `;
    db.query(sql, [userId], callback);
  },

  getAll: (callback) => {
    const sql = `
      SELECT o.id, o.userId, o.totalAmount, o.orderDate, o.status, o.payment_method, u.username
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, callback);
  }
};

module.exports = Order;