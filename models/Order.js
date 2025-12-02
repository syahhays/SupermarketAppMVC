const db = require('../db');

const Order = {
  create: (userId, totalAmount, callback) => {
    const sql = `
      INSERT INTO orders (userId, totalAmount)
      VALUES (?, ?)
    `;
    db.query(sql, [userId, totalAmount], callback);
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
      SELECT o.id, o.userId, o.totalAmount, o.orderDate, u.username
      FROM orders o
      LEFT JOIN users u ON o.userId = u.id
      ORDER BY o.orderDate DESC
    `;
    db.query(sql, callback);
  }
};

module.exports = Order;