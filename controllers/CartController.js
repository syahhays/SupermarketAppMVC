// controllers/CartController.js
const Product = require('../models/Product');
const CartItem = require('../models/CartItem');

// =======================
// ADD TO CART
// =======================
const addToCart = (req, res) => {
  const productId = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;

  Product.getById(productId, (err, results) => {
    if (err) {
      console.error('Error retrieving product:', err);
      return res.status(500).send('Error retrieving product');
    }

    if (results.length === 0) {
      return res.status(404).send('Product not found');
    }

    const product = results[0];

    if (!req.session.cart) req.session.cart = [];

    req.session.cart = CartItem.addItem(req.session.cart, product, quantity);

    res.redirect('/cart');
  });
};

// =======================
// VIEW CART
// =======================
const viewCart = (req, res) => {
  const cart = req.session.cart || [];
  const grandTotal = CartItem.calculateGrandTotal(cart);

  res.render('cart', {
    cart,
    grandTotal,
    user: req.session.user
  });
};

// =======================
// UPDATE QUANTITY
// =======================
const updateQuantity = (req, res) => {
  const productId = parseInt(req.params.productId);
  const newQty = parseInt(req.body.quantity);

  if (!req.session.cart) req.session.cart = [];

  const item = req.session.cart.find(i => i.productId === productId);

  if (item) {
    item.quantity = newQty;
  }

  res.redirect('/cart');
};

// =======================
// REMOVE ITEM
// =======================
const removeItem = (req, res) => {
  const productId = parseInt(req.params.productId);

  req.session.cart = req.session.cart.filter(i => i.productId !== productId);

  res.redirect('/cart');
};

// =======================
// CLEAR CART
// =======================
const clearCart = (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
};

// =======================
// CHECKOUT PAGE
// =======================
const checkoutPage = (req, res) => {
  const cart = req.session.cart || [];

  let grandTotal = 0;
  cart.forEach(item => {
    grandTotal += item.price * item.quantity;
  });

  res.render('checkout', {
    cart,
    grandTotal,
    user: req.session.user
  });
};

// =======================
// EXPORT ALL FUNCTIONS
// =======================
module.exports = {
  addToCart,
  viewCart,
  updateQuantity,
  removeItem,
  clearCart,
  checkoutPage
};