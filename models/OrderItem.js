const db = require('../db');

const OrderItem = {
    create: (orderId, productId, quantity, price, callback) => {
        const sql = `
            INSERT INTO order_items (orderId, productId, quantity, price)
            VALUES (?, ?, ?, ?)
        `;
        db.query(sql, [orderId, productId, quantity, price], callback);
    },

    getItemsByOrder: (orderId, callback) => {
        const sql = `
            SELECT oi.*, p.productName
            FROM order_items oi
            JOIN products p ON oi.productId = p.id
            WHERE orderId = ?
        `;
        db.query(sql, [orderId], callback);
    }
};

module.exports = OrderItem;