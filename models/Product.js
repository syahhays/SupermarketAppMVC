const db = require('../db');

const Product = {
    // Get all products
    getAll: (callback) => {
        const sql = 'SELECT * FROM products';
        db.query(sql, callback);
    },

    // Get product by ID
    getById: (id, callback) => {
        const sql = 'SELECT * FROM products WHERE id = ?';
        db.query(sql, [id], callback);
    },

    // Search products by name (case-insensitive)
    search: (query, callback) => {
        const sql = 'SELECT * FROM products WHERE productName LIKE ?';
        const term = `%${query}%`;
        db.query(sql, [term], callback);
    },

    // Suggest product names (id + productName), limited
    searchSuggest: (query, limit, callback) => {
        const sql = 'SELECT id, productName FROM products WHERE productName LIKE ? ORDER BY productName LIMIT ?';
        const term = `%${query}%`;
        db.query(sql, [term, limit || 8], callback);
    },

    // Add new product
    add: (productData, callback) => {
        const sql = `
            INSERT INTO products (productName, quantity, price, image)
            VALUES (?, ?, ?, ?)
        `;
        db.query(sql, [
            productData.productName,
            productData.quantity,
            productData.price,
            productData.image
        ], callback);
    },

    // Update product
    update: (id, productData, callback) => {
        const sql = `
            UPDATE products
            SET productName = ?, quantity = ?, price = ?, image = ?
            WHERE id = ?
        `;
        db.query(sql, [
            productData.productName,
            productData.quantity,
            productData.price,
            productData.image,
            id
        ], callback);
    },

    // Delete a product
    delete: (id, callback) => {
        const sql = 'DELETE FROM products WHERE id = ?';
        db.query(sql, [id], callback);
    },

    // Decrement product quantity by amount (clamp at 0)
    decrementQuantity: (id, amount, callback) => {
        const sql = `
            UPDATE products
            SET quantity = GREATEST(quantity - ?, 0)
            WHERE id = ?
        `;
        db.query(sql, [amount, id], callback);
    },
};

module.exports = Product;