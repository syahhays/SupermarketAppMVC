const Product = require('../models/Product');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const util = require('util');

const TAX_RATE = 0.07;      // 7% tax (adjust)
const SHIPPING_FLAT = 5.0;  // flat shipping

// ADD TO CART
const addToCart = (req, res) => {
  const productId = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;

  Product.getById(productId, (err, results) => {
    if (err) {
      console.error('Add to cart error:', err);
      req.flash('error', 'Error retrieving product.');
      return res.redirect('/shopping');
    }
    if (results.length === 0) {
      req.flash('error', 'Product not found.');
      return res.redirect('/shopping');
    }

    const product = results[0];

    if (!req.session.cart) req.session.cart = [];
    req.session.cart = CartItem.addItem(req.session.cart, product, quantity);

    req.flash('success', `${product.productName} added to cart.`);
    res.redirect('/cart');
  });
};

// VIEW CART
const viewCart = (req, res) => {
  const cart = req.session.cart || [];
  const grandTotal = CartItem.calculateGrandTotal(cart);

  res.render('cart', { cart, grandTotal });
};

// UPDATE QUANTITY
const updateQuantity = (req, res) => {
  const cart = req.session.cart || [];
  const productId = parseInt(req.params.productId);
  const newQty = parseInt(req.body.quantity);

  const item = cart.find((i) => i.productId === productId);
  if (item) item.quantity = newQty;

  req.flash('success', 'Item quantity updated.');
  res.redirect('/cart');
};

// REMOVE ITEM
const removeItem = (req, res) => {
  const productId = parseInt(req.params.productId);
  req.session.cart = (req.session.cart || []).filter((i) => i.productId !== productId);
  req.flash('info', 'Item removed from cart.');
  res.redirect('/cart');
};

// CLEAR CART
const clearCart = (req, res) => {
  req.session.cart = [];
  req.flash('info', 'Cart cleared.');
  res.redirect('/cart');
};

// GET /checkout
const checkoutPage = (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = (cart || []).reduce(
    (s, it) => s + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  const tax = +(subtotal * TAX_RATE);
  const shipping = cart.length ? SHIPPING_FLAT : 0;
  const total = subtotal + tax + shipping;

  res.render('checkout', {
    cart,
    subtotal,
    tax,
    shipping,
    total,
    grandTotal: total,
    orderDateString: new Date().toString(),
    paymentMethod: 'paynow',
    paymentMethodDisplay: 'Credit/Debit card'
  });
};

// POST /checkout (place order)
const placeOrder = async (req, res) => {
  const cart = req.session.cart || [];
  const user = req.session.user;
  if (!user) {
    req.flash('error', 'Please log in to place an order.');
    return res.redirect('/login');
  }

  if (!cart.length) {
    req.flash('error', 'Your cart is empty.');
    return res.redirect('/cart');
  }

  try {
    const getById = util.promisify(Product.getById);
    const createOrder = util.promisify(Order.create);
    const createItem = util.promisify(OrderItem.create);
    const decrement = util.promisify(Product.decrementQuantity);

    // stock check
    for (const it of cart) {
      const rows = await getById(it.productId);
      const prod = rows && rows[0];
      if (!prod || Number(prod.quantity) < Number(it.quantity)) {
        req.flash('error', `Insufficient stock for ${it.productName}.`);
        return res.redirect('/cart');
      }
    }

    const subtotal = cart.reduce(
      (s, it) => s + Number(it.price) * Number(it.quantity),
      0
    );
    const tax = subtotal * TAX_RATE;
    const shipping = cart.length ? SHIPPING_FLAT : 0;
    const total = subtotal + tax + shipping;

    const orderResult = await createOrder(user.id, total);
    const orderId = orderResult.insertId;

    for (const it of cart) {
      await createItem(orderId, it.productId, it.quantity, it.price);
      await decrement(it.productId, it.quantity);
    }

    req.session.cart = [];
    req.flash('success', 'Order placed successfully.');
    res.redirect('/orders/' + orderId);
  } catch (err) {
    console.error('Place order error', err);
    req.flash('error', 'Unable to place order. Please try again.');
    res.redirect('/cart');
  }
};

// ORDER HISTORY (User)
const orderHistory = (req, res) => {
  Order.getAllByUser(req.session.user.id, (err, orders) => {
    if (err) {
      console.error('Order history error:', err);
      req.flash('error', 'Error loading order history.');
      return res.redirect('/shopping');
    }

    orders = (orders || []).map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount || 0)
    }));

    res.render('orders', { orders });
  });
};

// ORDER DETAILS (User)
const orderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) {
      console.error('Order details error:', err);
      req.flash('error', 'Error loading order details.');
      return res.redirect('/orders');
    }

    let total = 0;
    items.forEach((i) => (total += i.price * i.quantity));

    res.render('orderDetails', {
      items,
      orderId: req.params.id,
      total
    });
  });
};

// ADMIN — view ALL orders
const adminOrders = (req, res) => {
  Order.getAll((err, orders) => {
    if (err) {
      console.error('Admin orders error:', err);
      req.flash('error', 'Error loading orders.');
      return res.redirect('/inventory');
    }

    res.render('adminOrders', {
      orders
    });
  });
};

// ADMIN — view order details
const adminOrderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) {
      console.error('Admin order details error:', err);
      req.flash('error', 'Error loading order details.');
      return res.redirect('/admin/orders');
    }

    items = (items || []).map((i) => ({
      ...i,
      price: Number(i.price || 0),
      quantity: Number(i.quantity || 0)
    }));

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    res.render('adminOrderDetails', {
      items,
      orderId: req.params.id,
      total
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