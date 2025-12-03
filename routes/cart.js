const express = require('express');
const router = express.Router();
const CartController = require('../controllers/CartController');

router.get('/checkout', CartController.checkoutPage);
router.post('/checkout', CartController.placeOrder);

module.exports = router;