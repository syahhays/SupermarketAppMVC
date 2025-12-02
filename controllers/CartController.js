const Product = require('../models/Product');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const util = require('util');

// ADD TO CART
const addToCart = (req, res) => {
  const productId = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;

  Product.getById(productId, (err, results) => {
    if (err) return res.status(500).send('Error retrieving product');
    if (results.length === 0) return res.status(404).send('Product not found');

    const product = results[0];

    if (!req.session.cart) req.session.cart = [];
    req.session.cart = CartItem.addItem(req.session.cart, product, quantity);

    res.redirect('/cart');
  });
};

// VIEW CART
const viewCart = (req, res) => {
  const cart = req.session.cart || [];
  const grandTotal = CartItem.calculateGrandTotal(cart);

  res.render('cart', { cart, grandTotal, user: req.session.user });
};

// UPDATE QUANTITY
const updateQuantity = (req, res) => {
  const cart = req.session.cart || [];
  const productId = parseInt(req.params.productId);
  const newQty = parseInt(req.body.quantity);

  const item = cart.find(i => i.productId === productId);
  if (item) item.quantity = newQty;

  res.redirect('/cart');
};

// REMOVE ITEM
const removeItem = (req, res) => {
  req.session.cart = (req.session.cart || []).filter(i => i.productId !== parseInt(req.params.productId));
  res.redirect('/cart');
};

// CLEAR CART
const clearCart = (req, res) => {
  req.session.cart = [];
  res.redirect('/cart');
};

// CHECKOUT PAGE
const checkoutPage = (req, res) => {
  const cart = req.session.cart || [];
  const grandTotal = CartItem.calculateGrandTotal(cart);

  res.render('checkout', { cart, grandTotal, user: req.session.user });
};

// PLACE ORDER
const placeOrder = async (req, res) => {
  const cart = req.session.cart || [];
  const user = req.session.user;

  if (cart.length === 0) return res.redirect('/cart');

  try {
    // promisify model methods
    const getById = util.promisify(Product.getById);
    const createOrder = util.promisify(Order.create);
    const createOrderItem = util.promisify(OrderItem.create);
    const decrement = util.promisify(Product.decrementQuantity);

    // 1) check stock for every item
    for (const item of cart) {
      const rows = await getById(item.productId);
      if (!rows || rows.length === 0) {
        req.flash('error', 'Product not found: ' + item.productId);
        return res.redirect('/cart');
      }
      const prod = rows[0];
      if (Number(prod.quantity) < Number(item.quantity)) {
        req.flash('error', `Insufficient stock for ${prod.productName}. Available: ${prod.quantity}`);
        return res.redirect('/cart');
      }
    }

    // 2) compute total
    let grandTotal = 0;
    cart.forEach(item => (grandTotal += item.price * item.quantity));

    // 3) create order
    const orderResult = await createOrder(user.id, grandTotal);
    const orderId = orderResult.insertId;

    // 4) create order items and decrement stock
    for (const item of cart) {
      await createOrderItem(orderId, item.productId, item.quantity, item.price);
      await decrement(item.productId, item.quantity);
    }

    // 5) clear cart and redirect
    req.session.cart = [];
    res.redirect('/orders/' + orderId);
  } catch (err) {
    console.error('Order error:', err);
    req.flash('error', 'Unable to place order. Try again.');
    res.redirect('/cart');
  }
};

// ORDER HISTORY (User)
const orderHistory = (req, res) => {
  Order.getAllByUser(req.session.user.id, (err, orders) => {
    if (err) return res.status(500).send('History error');

    // ensure totalAmount is numeric for templates
    orders = (orders || []).map(o => ({ ...o, totalAmount: Number(o.totalAmount || 0) }));

    res.render('orders', { orders, user: req.session.user });
  });
};

// ORDER DETAILS (User)
const orderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) return res.status(500).send('Details error');

    let total = 0;
    items.forEach(i => (total += i.price * i.quantity));

    res.render('orderDetails', {
      items,
      orderId: req.params.id,
      total,
      user: req.session.user
    });
  });
};

// ADMIN — view ALL orders
const adminOrders = (req, res) => {
  Order.getAll((err, orders) => {
    if (err) return res.status(500).send('Admin order error');

    res.render('adminOrders', {
      orders,
      user: req.session.user
    });
  });
};

// ADMIN — view order details
const adminOrderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) return res.status(500).send('Admin detail error');

    // ensure numeric prices/qty and compute total
    items = (items || []).map(i => ({
      ...i,
      price: Number(i.price || 0),
      quantity: Number(i.quantity || 0)
    }));

    let total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    res.render('adminOrderDetails', {
      items,
      orderId: req.params.id,
      total,
      user: req.session.user
    });
  });
};

module.exports = {
  addToCart,
  viewCart,
  updateQuantity,
  removeItem,
  clearCart,
  checkoutPage,
  placeOrder,
  orderHistory,
  orderDetails,
  adminOrders,
  adminOrderDetails
};