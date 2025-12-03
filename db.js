const mysql = require('mysql2');
require('dotenv').config(); // Load variables from .env

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'RP738964$',
  database: process.env.DB_NAME || 'c372_supermarketdb',   
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// export pool that has .query
module.exports = pool.promise ? pool : pool;