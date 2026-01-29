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

  getById: (orderId, callback) => {
    const sql = `
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
    `;
    db.query(sql, [orderId], callback);
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
      SELECT o.*,
             p.provider AS payment_provider,
             p.status AS payment_status,
             p.provider_ref,
             p.refund_ref,
             p.refunded_at
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.userId = ?
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, [userId], callback);
  },

  getAll: (callback) => {
    const sql = `
      SELECT o.id, o.userId, o.totalAmount, o.orderDate, o.status, o.payment_method, u.username,
             p.provider AS payment_provider,
             p.status AS payment_status,
             p.provider_ref,
             p.refund_ref,
             p.refunded_at
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      LEFT JOIN payments p ON p.order_id = o.id
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, callback);
  }
};

module.exports = Order;
