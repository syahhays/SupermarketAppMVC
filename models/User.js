// models/User.js
const db = require('../db');

const User = {
  // Create a new user
  create: (userData, callback) => {
    const { username, email, password, address, contact_number, role } = userData;

    const sql = `
      INSERT INTO users (username, email, password, address, contact_number, role)
      VALUES (?, ?, SHA1(?), ?, ?, ?)
    `;

    db.query(
      sql,
      [username, email, password, address, contact_number, role],
      callback
    );
  },

  // Authenticate user by email + password
  authenticate: (email, password, callback) => {
    const sql = `
      SELECT * FROM users
      WHERE email = ? AND password = SHA1(?)
    `;

    db.query(sql, [email, password], (err, results) => {
      if (err) return callback(err, null);

      if (results.length > 0) {
        return callback(null, results[0]);
      } else {
        return callback(null, null);
      }
    });
  },

  // Find by id
  findById: (id, callback) => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err, null);
      if (results.length > 0) return callback(null, results[0]);
      return callback(null, null);
    });
  }
};

module.exports = User;