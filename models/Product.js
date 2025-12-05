const db = require('../db');

const Product = {
  // Get all products (ADMIN – includes inactive)
  getAll: (callback) => {
    const sql = 'SELECT * FROM products ORDER BY productName';
    db.query(sql, callback);
  },

  // Get product by ID (for details, cart, etc.)
  getById: (id, callback) => {
    const sql = 'SELECT * FROM products WHERE id = ?';
    db.query(sql, [id], callback);
  },

  // Search products by name (for shop page, still returns both active/inactive)
  search: (query, callback) => {
    const sql = 'SELECT * FROM products WHERE productName LIKE ? ORDER BY productName';
    const term = `%${query}%`;
    db.query(sql, [term], callback);
  },

  // Category filter
  getByCategory: (category, callback) => {
    const sql = 'SELECT * FROM products WHERE category = ? ORDER BY productName';
    db.query(sql, [category], callback);
  },

  // Autosuggest (used by your search bar)
  searchSuggest: (query, limit, callback) => {
    const sql = `
      SELECT id, productName
      FROM products
      WHERE productName LIKE ?
      ORDER BY productName
      LIMIT ?
    `;
    const term = `%${query}%`;
    db.query(sql, [term, limit || 8], callback);
  },

  // Add new product – default isActive = 1 (available)
  add: (productData, callback) => {
    const sql = `
      INSERT INTO products (productName, quantity, price, image, category, isActive)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        productData.productName,
        productData.quantity,
        productData.price,
        productData.image,
        productData.category,
        productData.isActive ?? 1 // default to active
      ],
      callback
    );
  },

  // Update product (we do NOT touch isActive here)
  update: (id, productData, callback) => {
    const sql = `
      UPDATE products
      SET productName = ?, quantity = ?, price = ?, image = ?, category = ?
      WHERE id = ?
    `;
    db.query(
      sql,
      [
        productData.productName,
        productData.quantity,
        productData.price,
        productData.image,
        productData.category,
        id
      ],
      callback
    );
  },

  // ❌ HARD delete (we will STOP using this in controllers)
  delete: (id, callback) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], callback);
  },

  // ✅ SOFT delete: mark product as unavailable
  markInactive: (id, callback) => {
    const sql = 'UPDATE products SET isActive = 0 WHERE id = ?';
    db.query(sql, [id], callback);
  },

  // (Optional) Mark product back to active – not used yet but nice to have
  markActive: (id, callback) => {
    const sql = 'UPDATE products SET isActive = 1 WHERE id = ?';
    db.query(sql, [id], callback);
  },

  // Decrement quantity after purchase
  decrementQuantity: (id, amount, callback) => {
    const sql = `
      UPDATE products
      SET quantity = GREATEST(quantity - ?, 0)
      WHERE id = ?
    `;
    db.query(sql, [amount, id], callback);
  }
};

module.exports = Product;