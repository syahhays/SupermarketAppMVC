const db = require('../db');

const RefundRequest = {
  create: (orderId, userId, reason, callback) => {
    const sql = `
      INSERT INTO refund_requests (order_id, user_id, reason, status)
      VALUES (?, ?, ?, 'PENDING')
    `;
    db.query(sql, [orderId, userId, reason], callback);
  },

  getByOrderId: (orderId, callback) => {
    const sql = `
      SELECT *
      FROM refund_requests
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    db.query(sql, [orderId], callback);
  },

  getAll: (callback) => {
    const sql = `
      SELECT rr.*, o.totalAmount, o.payment_method, u.username
      FROM refund_requests rr
      JOIN orders o ON o.id = rr.order_id
      JOIN users u ON u.id = rr.user_id
      ORDER BY rr.created_at DESC
    `;
    db.query(sql, callback);
  },

  getById: (id, callback) => {
    const sql = `
      SELECT rr.*, o.totalAmount, o.payment_method, u.username
      FROM refund_requests rr
      JOIN orders o ON o.id = rr.order_id
      JOIN users u ON u.id = rr.user_id
      WHERE rr.id = ?
      LIMIT 1
    `;
    db.query(sql, [id], callback);
  },

  updateStatus: (id, status, adminNote, callback) => {
    const sql = `
      UPDATE refund_requests
      SET status = ?, admin_note = ?, updated_at = NOW()
      WHERE id = ?
    `;
    db.query(sql, [status, adminNote || null, id], callback);
  }
};

module.exports = RefundRequest;
