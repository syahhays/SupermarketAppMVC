// controllers/CartController.js
const Product = require('../models/Product');
const CartItem = require('../models/CartItem');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const util = require('util');

const TAX_RATE = 0.07;       // 7%
const SHIPPING_FLAT = 5.0;   // flat shipping fee

/* =========================================================
   ADD TO CART — respects stock & cart content
   ========================================================= */
const addToCart = (req, res) => {
  const productId = parseInt(req.params.id);
  const requestedQty = parseInt(req.body.quantity) || 1;

  Product.getById(productId, (err, results) => {
    if (err || !results || results.length === 0) {
      console.error('Add to cart error:', err);
      req.flash('error', 'Product not found.');
      return res.redirect('/shopping');
    }

    const product = results[0];
    const dbQty = Number(product.quantity || 0);

    if (!product.isActive || dbQty <= 0) {
      req.flash('error', 'Sorry, this product is unavailable or out of stock.');
      return res.redirect('/shopping');
    }

    if (!req.session.cart) req.session.cart = [];
    const cart = req.session.cart;

    const existing = cart.find((i) => i.productId === productId);
    const inCart = existing ? Number(existing.quantity || 0) : 0;

    const remaining = dbQty - inCart;
    if (remaining <= 0) {
      req.flash('error', `No more stock available for ${product.productName}.`);
      return res.redirect('/shopping');
    }

    const qtyToAdd = Math.min(requestedQty, remaining);
    req.session.cart = CartItem.addItem(cart, product, qtyToAdd);

    req.flash('success', `${product.productName} added to cart.`);
    res.redirect('/cart');
  });
};

/* =========================================================
   VIEW CART
   ========================================================= */
const viewCart = (req, res) => {
  const cart = req.session.cart || [];
  const grandTotal = CartItem.calculateGrandTotal(cart);
  res.render('cart', { cart, grandTotal });
};

/* =========================================================
   UPDATE QUANTITY — respects DB stock
   ========================================================= */
const updateQuantity = (req, res) => {
  const cart = req.session.cart || [];
  const productId = parseInt(req.params.productId);
  let newQty = parseInt(req.body.quantity);

  const item = cart.find((i) => i.productId === productId);
  if (!item) {
    req.flash('error', 'Item not found in cart.');
    return res.redirect('/cart');
  }

  Product.getById(productId, (err, results) => {
    if (err || !results || results.length === 0) {
      console.error('Update quantity error:', err);
      req.flash('error', 'Unable to update quantity.');
      return res.redirect('/cart');
    }

    const product = results[0];
    const dbQty = Number(product.quantity || 0);

    if (isNaN(newQty) || newQty < 1) newQty = 1;

    if (newQty > dbQty) {
      newQty = dbQty;
      req.flash('error', `Only ${dbQty} units of ${product.productName} are available.`);
    }

    item.quantity = newQty;

    req.flash('success', 'Item quantity updated.');
    res.redirect('/cart');
  });
};

/* =========================================================
   REMOVE & CLEAR CART
   ========================================================= */
const removeItem = (req, res) => {
  const productId = parseInt(req.params.productId);
  req.session.cart = (req.session.cart || []).filter((i) => i.productId !== productId);
  req.flash('info', 'Item removed from cart.');
  res.redirect('/cart');
};

const clearCart = (req, res) => {
  req.session.cart = [];
  req.flash('info', 'Cart cleared.');
  res.redirect('/cart');
};

/* =========================================================
   CHECKOUT PAGE (PayPal-ready)
   ========================================================= */
const checkoutPage = (req, res) => {
  const cart = req.session.cart || [];
  const subtotal = cart.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  const tax = subtotal * TAX_RATE;
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

    // show this on UI
    paymentMethod: 'paypal',
    paymentMethodDisplay: 'PayPal',

    // PayPal SDK needs client id
    paypalClientId: process.env.PAYPAL_CLIENT_ID,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    currency: 'SGD'
  });
};

/* =========================================================
   (Keep this for later if you do NETS / manual checkout)
   PLACE ORDER — decrements DB stock
   ========================================================= */
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

    for (const it of cart) {
      const rows = await getById(it.productId);
      const prod = rows && rows[0];
      if (!prod || Number(prod.quantity) < Number(it.quantity)) {
        req.flash('error', `Insufficient stock for ${it.productName}.`);
        return res.redirect('/cart');
      }
    }

    const subtotal = cart.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0);
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

/* =========================================================
   ORDER HISTORY + DETAILS (USER)
   ========================================================= */
const orderHistory = (req, res) => {
  Order.getAllByUser(req.session.user.id, (err, orders) => {
    if (err) {
      console.error('Order history error:', err);
      req.flash('error', 'Error loading order history.');
      return res.redirect('/shopping');
    }
    res.render('orders', { orders });
  });
};

const orderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) {
      console.error('Order details error:', err);
      req.flash('error', 'Error loading order details.');
      return res.redirect('/orders');
    }

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.price) * Number(i.quantity),
      0
    );
    const tax = subtotal * TAX_RATE;
    const shipping = items.length ? SHIPPING_FLAT : 0;
    const total = subtotal + tax + shipping;

    Order.getById(req.params.id, (orderErr, orderRows) => {
      if (orderErr) {
        console.error('Order details order error:', orderErr);
        req.flash('error', 'Error loading order details.');
        return res.redirect('/orders');
      }
      const order = orderRows && orderRows[0];

      const Payment = require('../models/Payment');
      Payment.getByOrderId(req.params.id, (payErr, paymentRows) => {
        if (payErr) {
          console.error('Order details payment error:', payErr);
        }
        const payment = paymentRows && paymentRows[0] ? paymentRows[0] : null;

        res.render('orderDetails', {
          items,
          orderId: req.params.id,
          subtotal,
          tax,
          shipping,
          total,
          order,
          payment
        });
      });
    });
  });
};

/* =========================================================
   ADMIN — VIEW ALL ORDERS
   ========================================================= */
const adminOrders = (req, res) => {
  Order.getAll((err, orders) => {
    if (err) {
      console.error('Admin orders error:', err);
      req.flash('error', 'Error loading orders.');
      return res.redirect('/inventory');
    }
    res.render('adminOrders', { orders });
  });
};

const adminOrderDetails = (req, res) => {
  OrderItem.getItemsByOrder(req.params.id, (err, items) => {
    if (err) {
      console.error('Admin order details error:', err);
      req.flash('error', 'Error loading order details.');
      return res.redirect('/admin/orders');
    }

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.price) * Number(i.quantity),
      0
    );
    const tax = subtotal * TAX_RATE;
    const shipping = items.length ? SHIPPING_FLAT : 0;
    const total = subtotal + tax + shipping;

    Order.getById(req.params.id, (orderErr, orderRows) => {
      if (orderErr) {
        console.error('Admin order details order error:', orderErr);
        req.flash('error', 'Error loading order details.');
        return res.redirect('/admin/orders');
      }
      const order = orderRows && orderRows[0];

      const Payment = require('../models/Payment');
      Payment.getByOrderId(req.params.id, (payErr, paymentRows) => {
        if (payErr) {
          console.error('Admin order details payment error:', payErr);
        }
        const payment = paymentRows && paymentRows[0] ? paymentRows[0] : null;

        res.render('adminOrderDetails', {
          items,
          orderId: req.params.id,
          total,
          subtotal,
          tax,
          shipping,
          order,
          payment
        });
      });
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
