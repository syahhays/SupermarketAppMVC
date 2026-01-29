// models/Payment.js
const db = require('../db');

const Payment = {
  create: (orderId, userId, provider, amount, currency, status, payerEmail, providerRef, callback) => {
    const sql = `
      INSERT INTO payments (order_id, user_id, provider, provider_ref, amount, currency, status, payer_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [orderId, userId, provider, providerRef || null, amount, currency, status, payerEmail || null],
      callback
    );
  },

  updateByOrder: (orderId, fields, callback) => {
    const { status, providerRef, payerEmail } = fields;

    const sql = `
      UPDATE payments
      SET status = COALESCE(?, status),
          provider_ref = COALESCE(?, provider_ref),
          payer_email = COALESCE(?, payer_email)
      WHERE order_id = ?
    `;

    db.query(sql, [status || null, providerRef || null, payerEmail || null, orderId], callback);
  },

  getByProviderRef: (providerRef, callback) => {
    const sql = `
      SELECT *
      FROM payments
      WHERE provider_ref = ?
      LIMIT 1
    `;
    db.query(sql, [providerRef], callback);
  }
};

module.exports = Payment;
