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
    }
};

module.exports = Product;