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
    const { status, providerRef, payerEmail, refundRef, refundedAt, refundReason } = fields;

    const sql = `
      UPDATE payments
      SET status = COALESCE(?, status),
          provider_ref = COALESCE(?, provider_ref),
          payer_email = COALESCE(?, payer_email),
          refund_ref = COALESCE(?, refund_ref),
          refunded_at = COALESCE(?, refunded_at),
          refund_reason = COALESCE(?, refund_reason)
      WHERE order_id = ?
    `;

    db.query(
      sql,
      [
        status || null,
        providerRef || null,
        payerEmail || null,
        refundRef || null,
        refundedAt || null,
        refundReason || null,
        orderId
      ],
      callback
    );
  },

  getByProviderRef: (providerRef, callback) => {
    const sql = `
      SELECT *
      FROM payments
      WHERE provider_ref = ?
      LIMIT 1
    `;
    db.query(sql, [providerRef], callback);
  },

  getByOrderId: (orderId, callback) => {
    const sql = `
      SELECT *
      FROM payments
      WHERE order_id = ?
      LIMIT 1
    `;
    db.query(sql, [orderId], callback);
  }
};

module.exports = Payment;
