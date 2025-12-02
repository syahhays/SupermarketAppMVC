const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

function ensureAdmin(req, res, next) {
  if (req.user && String(req.user.role || '').toLowerCase().trim() === 'admin') return next();
  return res.status(403).send('Forbidden');
}

router.get('/orders', ensureAdmin, (req, res) => {
  Order.getAll((err, rows) => {
    if (err) {
      console.error('Error loading orders:', err);
      return res.status(500).send('Server error loading orders');
    }
    res.render('adminOrders', { orders: rows || [], user: req.user });
  });
});

module.exports = router;