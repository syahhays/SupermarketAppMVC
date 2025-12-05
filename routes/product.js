// routes/product.js
const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/ProductController');

// Enable a product
router.get('/product/:id/enable', ProductController.enableProduct);

// Disable a product
router.get('/product/:id/disable', ProductController.disableProduct);

module.exports = router;