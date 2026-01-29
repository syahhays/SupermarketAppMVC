const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();

// Controllers
const ProductController = require('./controllers/ProductController');
const UserController = require('./controllers/UserController');
const CartController = require('./controllers/CartController');
const Product = require('./models/Product');

// =========================
// AUTOSUGGEST API
// =========================
app.get('/api/products/suggest', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = parseInt(req.query.limit, 10) || 8;

  if (!q) return res.json([]);

  Product.searchSuggest(q, limit, (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows || []);
  });
});

// =========================
// MULTER (IMAGE UPLOAD)
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// =========================
// VIEW ENGINE + MIDDLEWARE
// =========================
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);

app.use(flash());

app.locals.pendingStripeCarts = new Map();

// GLOBAL TEMPLATE VARIABLES
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;

  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.infoMessages = req.flash('info');
  next();
});

// =========================
// AUTH MIDDLEWARES
// =========================
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Please log in.');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Access denied. Admin only.');
  res.redirect('/');
};

const checkCustomer = (req, res, next) => {
  if (req.session.user && req.session.user.role !== 'admin') return next();
  req.flash('error', 'Customers only.');
  res.redirect('/');
};

// =========================
// REGISTRATION VALIDATION  ✅ FIXED
// =========================
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact_number } = req.body;

  if (!username || !email || !password || !address || !contact_number) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password must be at least 6 characters.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  next();
};

// =========================
// ROUTES
// =========================

// HOME
app.get('/', UserController.home);

// =========================
// PRODUCT PAGES
// =========================

// ADMIN inventory + product mgmt
app.get('/inventory', checkAuthenticated, checkAdmin, ProductController.inventory);
app.get('/addProduct', checkAuthenticated, checkAdmin, ProductController.addForm);
app.post(
  '/addProduct',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  ProductController.addProduct
);

app.get(
  '/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  ProductController.updateForm
);
app.post(
  '/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  ProductController.updateProduct
);

// Enable / Disable product
app.get(
  '/product/:id/disable',
  checkAuthenticated,
  checkAdmin,
  ProductController.disableProduct
);
app.get(
  '/product/:id/enable',
  checkAuthenticated,
  checkAdmin,
  ProductController.enableProduct
);

// CUSTOMER shop pages
app.get('/shopping', checkAuthenticated, checkCustomer, ProductController.shopping);
app.get('/product/:id', checkAuthenticated, checkCustomer, ProductController.getProduct);

// =========================
// USER AUTH
// =========================
app.get('/register', UserController.showRegister);
app.post('/register', validateRegistration, UserController.register);

app.get('/login', UserController.showLogin);
app.post('/login', UserController.login);

app.get('/logout', UserController.logout);

// =========================
// CART (CUSTOMER ONLY)
// =========================
app.post(
  '/add-to-cart/:id',
  checkAuthenticated,
  checkCustomer,
  CartController.addToCart
);
app.get('/cart', checkAuthenticated, checkCustomer, CartController.viewCart);

app.post(
  '/cart/update/:productId',
  checkAuthenticated,
  checkCustomer,
  CartController.updateQuantity
);
app.get(
  '/cart/remove/:productId',
  checkAuthenticated,
  checkCustomer,
  CartController.removeItem
);
app.get('/cart/clear', checkAuthenticated, checkCustomer, CartController.clearCart);

// =========================
// CHECKOUT + ORDERS
// =========================
app.get('/checkout', checkAuthenticated, checkCustomer, CartController.checkoutPage);
app.post('/checkout', checkAuthenticated, checkCustomer, CartController.placeOrder);

app.get('/orders', checkAuthenticated, checkCustomer, CartController.orderHistory);
app.get('/orders/:id', checkAuthenticated, checkCustomer, CartController.orderDetails);

const paypal = require('./services/paypal');
const nets = require('./services/nets');
const stripeService = require('./services/stripe');
const Payment = require('./models/Payment');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const util = require('util');
const ProductModel = require('./models/Product');

// =========================
// STRIPE WEBHOOK (raw body)
// =========================
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.constructEvent(req.body, sig);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook received:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('Stripe payment_intent succeeded:', paymentIntent.id);
    const localOrderId = paymentIntent.metadata && paymentIntent.metadata.localOrderId
      ? Number(paymentIntent.metadata.localOrderId)
      : null;

    if (!localOrderId) {
      return res.status(200).json({ received: true });
    }

    try {
      const pendingCart = app.locals.pendingStripeCarts
        ? app.locals.pendingStripeCarts.get(localOrderId)
        : null;

      let cart = null;
      if (pendingCart && pendingCart.cart && pendingCart.cart.length) {
        cart = pendingCart.cart;
      }

      const getById = util.promisify(ProductModel.getById);
      const createItem = util.promisify(OrderItem.create);
      const decrement = util.promisify(ProductModel.decrementQuantity);
      const updateOrderStatus = util.promisify(Order.updateStatus);
      const updatePayment = util.promisify(Payment.updateByOrder);

      if (!cart) {
        const getItems = util.promisify(OrderItem.getItemsByOrder);
        const existingItems = await getItems(localOrderId);
        if (!existingItems || !existingItems.length) {
          console.error('Stripe webhook missing items for order', localOrderId);
          return res.status(200).json({ received: true });
        }
        cart = existingItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          price: it.price,
          productName: it.productName
        }));
      }

      for (const it of cart) {
        const rows = await getById(it.productId);
        const prod = rows && rows[0];
        if (!prod || Number(prod.quantity) < Number(it.quantity)) {
          await updateOrderStatus(localOrderId, 'FAILED');
          await updatePayment(localOrderId, { status: 'FAILED' });
          return res.status(200).json({ received: true });
        }
      }

      for (const it of cart) {
        await decrement(it.productId, it.quantity);
      }

      await updateOrderStatus(localOrderId, 'PAID');

      await updatePayment(localOrderId, {
        status: 'COMPLETED',
        providerRef: paymentIntent.id
      });

      if (app.locals.pendingStripeCarts) {
        app.locals.pendingStripeCarts.delete(localOrderId);
      }
    } catch (err) {
      console.error('Stripe webhook finalize error:', err);
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    const localOrderId = paymentIntent.metadata && paymentIntent.metadata.localOrderId
      ? Number(paymentIntent.metadata.localOrderId)
      : null;

    if (localOrderId) {
      const updateOrderStatus = util.promisify(Order.updateStatus);
      const updatePayment = util.promisify(Payment.updateByOrder);
      await updateOrderStatus(localOrderId, 'FAILED');
      await updatePayment(localOrderId, { status: 'FAILED', providerRef: paymentIntent.id });
      if (app.locals.pendingStripeCarts) {
        app.locals.pendingStripeCarts.delete(localOrderId);
      }
    }
  }

  return res.status(200).json({ received: true });
});

// JSON body parser for normal routes (must be after webhook)
app.use(express.json());

app.post('/paypal/create-order', checkAuthenticated, checkCustomer, async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const user = req.session.user;

    if (!cart.length) return res.status(400).json({ error: 'Cart is empty.' });

    // totals (same logic as CartController)
    const TAX_RATE = 0.07;
    const SHIPPING_FLAT = 5.0;

    const subtotal = cart.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
    const tax = subtotal * TAX_RATE;
    const shipping = cart.length ? SHIPPING_FLAT : 0;
    const total = subtotal + tax + shipping;

    // create local order PENDING
    const createOrder = util.promisify(Order.create);
    const orderResult = await createOrder(user.id, total, 'paypal', 'PENDING');
    const localOrderId = orderResult.insertId;

    // create local payment record CREATED
    const createPayment = util.promisify(Payment.create);
    await createPayment(localOrderId, user.id, 'paypal', total, 'SGD', 'CREATED', user.email, null);

    // create PayPal order with return/cancel URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const returnUrl = `${baseUrl}/paypal/return`;
    const cancelUrl = `${baseUrl}/paypal/cancel`;
    const ppOrder = await paypal.createPaypalOrder(total, 'SGD', returnUrl, cancelUrl);

    // store mapping in session so capture knows which local order to finalize
    req.session.pendingOrderId = localOrderId;

    // also update provider_ref now
    const updatePayment = util.promisify(Payment.updateByOrder);
    await updatePayment(localOrderId, { providerRef: ppOrder.id });

    const approveLink =
      (ppOrder.links || []).find((l) => l.rel === 'approve') ||
      (ppOrder.links || []).find((l) => l.rel === 'payer-action');

    return res.json({ id: ppOrder.id, approveLink: approveLink ? approveLink.href : null });
  } catch (err) {
    console.error('PayPal create-order error:', err);
    return res.status(500).json({ error: 'Unable to create PayPal order.' });
  }
});

app.get('/paypal/return', checkAuthenticated, checkCustomer, async (req, res) => {
  try {
    const orderID = req.query.token || req.query.orderID;
    const cart = req.session.cart || [];
    const user = req.session.user;

    const localOrderId = req.session.pendingOrderId;
    if (!localOrderId) return res.redirect('/checkout');
    if (!cart.length) return res.redirect('/cart');

    const capture = await paypal.capturePaypalOrder(orderID);

    if (!capture || capture.status !== 'COMPLETED') {
      return res.redirect('/checkout');
    }

    const getById = util.promisify(ProductModel.getById);
    const createItem = util.promisify(OrderItem.create);
    const decrement = util.promisify(ProductModel.decrementQuantity);
    const updateOrderStatus = util.promisify(Order.updateStatus);
    const updatePayment = util.promisify(Payment.updateByOrder);

    for (const it of cart) {
      const rows = await getById(it.productId);
      const prod = rows && rows[0];
      if (!prod || Number(prod.quantity) < Number(it.quantity)) {
        await updatePayment(localOrderId, { status: 'FAILED' });
        return res.redirect('/cart');
      }
    }

    for (const it of cart) {
      await createItem(localOrderId, it.productId, it.quantity, it.price);
      await decrement(it.productId, it.quantity);
    }

    await updateOrderStatus(localOrderId, 'PAID');

    const payerEmail =
      capture.payer && capture.payer.email_address ? capture.payer.email_address : null;
    const captureId =
      capture &&
      capture.purchase_units &&
      capture.purchase_units[0] &&
      capture.purchase_units[0].payments &&
      capture.purchase_units[0].payments.captures &&
      capture.purchase_units[0].payments.captures[0]
        ? capture.purchase_units[0].payments.captures[0].id
        : null;

    await updatePayment(localOrderId, {
      status: 'COMPLETED',
      providerRef: captureId || orderID,
      payerEmail
    });

    req.session.cart = [];
    req.session.pendingOrderId = null;

    return res.redirect('/orders/' + localOrderId);
  } catch (err) {
    console.error('PayPal return error:', err);
    return res.redirect('/checkout');
  }
});

app.get('/paypal/cancel', checkAuthenticated, checkCustomer, (req, res) => {
  req.flash('info', 'PayPal payment cancelled.');
  return res.redirect('/checkout');
});

app.post('/paypal/capture-order', checkAuthenticated, checkCustomer, async (req, res) => {
  try {
    const { orderID } = req.body;
    const cart = req.session.cart || [];
    const user = req.session.user;

    const localOrderId = req.session.pendingOrderId;
    if (!localOrderId) return res.status(400).json({ error: 'No pending local order.' });
    if (!cart.length) return res.status(400).json({ error: 'Cart is empty.' });

    // capture on PayPal
    const capture = await paypal.capturePaypalOrder(orderID);

    // basic success check
    if (!capture || capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed.' });
    }

    // finalize local order: order_items + decrement stock
    const getById = util.promisify(ProductModel.getById);
    const createItem = util.promisify(OrderItem.create);
    const decrement = util.promisify(ProductModel.decrementQuantity);
    const updateOrderStatus = util.promisify(Order.updateStatus);
    const updatePayment = util.promisify(Payment.updateByOrder);

    // stock re-check (important)
    for (const it of cart) {
      const rows = await getById(it.productId);
      const prod = rows && rows[0];
      if (!prod || Number(prod.quantity) < Number(it.quantity)) {
        await updatePayment(localOrderId, { status: 'FAILED' });
        return res.status(400).json({ error: `Insufficient stock for ${it.productName}.` });
      }
    }

    for (const it of cart) {
      await createItem(localOrderId, it.productId, it.quantity, it.price);
      await decrement(it.productId, it.quantity);
    }

    // mark PAID + payment COMPLETED
    await updateOrderStatus(localOrderId, 'PAID');

    // payer email from capture (best-effort)
    const payerEmail = capture.payer && capture.payer.email_address ? capture.payer.email_address : null;
    const captureId =
      capture &&
      capture.purchase_units &&
      capture.purchase_units[0] &&
      capture.purchase_units[0].payments &&
      capture.purchase_units[0].payments.captures &&
      capture.purchase_units[0].payments.captures[0]
        ? capture.purchase_units[0].payments.captures[0].id
        : null;

    await updatePayment(localOrderId, {
      status: 'COMPLETED',
      providerRef: captureId || orderID,
      payerEmail
    });

    // clear cart + pending
    req.session.cart = [];
    req.session.pendingOrderId = null;

    return res.json({ ok: true, localOrderId });
  } catch (err) {
    console.error('PayPal capture-order error:', err);
    return res.status(500).json({ error: 'Unable to capture PayPal payment.' });
  }
});

// =========================
// STRIPE CHECKOUT
// =========================
app.post('/stripe/create-payment-intent', checkAuthenticated, checkCustomer, async (req, res) => {
  try {
    const cart = req.session.cart || [];
    const user = req.session.user;

    if (!cart.length) return res.status(400).json({ error: 'Cart is empty.' });

    const TAX_RATE = 0.07;
    const SHIPPING_FLAT = 5.0;

    const subtotal = cart.reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
    const tax = subtotal * TAX_RATE;
    const shipping = cart.length ? SHIPPING_FLAT : 0;
    const total = subtotal + tax + shipping;

    const getById = util.promisify(ProductModel.getById);
    const createOrder = util.promisify(Order.create);
    const createItem = util.promisify(OrderItem.create);

    for (const it of cart) {
      const rows = await getById(it.productId);
      const prod = rows && rows[0];
      if (!prod || Number(prod.quantity) < Number(it.quantity)) {
        return res.status(400).json({ error: `Insufficient stock for ${it.productName}.` });
      }
    }

    const orderResult = await createOrder(user.id, total, 'stripe', 'PENDING');
    const localOrderId = orderResult.insertId;

    for (const it of cart) {
      await createItem(localOrderId, it.productId, it.quantity, it.price);
    }

    const createPayment = util.promisify(Payment.create);
    await createPayment(localOrderId, user.id, 'stripe', total, 'SGD', 'CREATED', user.email, null);

    const intent = await stripeService.createPaymentIntent({
      cart,
      user,
      localOrderId
    });

    const updatePayment = util.promisify(Payment.updateByOrder);
    await updatePayment(localOrderId, { providerRef: intent.id });

    app.locals.pendingStripeCarts.set(localOrderId, {
      cart,
      userId: user.id,
      createdAt: Date.now()
    });

    return res.json({ clientSecret: intent.client_secret, orderId: localOrderId });
  } catch (err) {
    console.error('Stripe create-payment-intent error:', err);
    return res.status(500).json({ error: 'Unable to start Stripe payment.' });
  }
});

app.get('/stripe/return', checkAuthenticated, checkCustomer, async (req, res) => {
  const clientSecret = req.query.payment_intent_client_secret;
  if (!clientSecret) return res.redirect('/orders');

  const paymentIntentId = clientSecret.split('_secret_')[0];
  if (!paymentIntentId) return res.redirect('/orders');

  try {
    const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
    const status = paymentIntent && paymentIntent.status;

    Payment.getByProviderRef(paymentIntentId, (err, rows) => {
      if (err || !rows || !rows.length) return res.redirect('/orders');
      const orderId = rows[0].order_id;
      if (status === 'succeeded') {
        req.session.cart = [];
        return res.redirect('/orders/' + orderId);
      }
      return res.redirect('/orders');
    });
  } catch (err) {
    console.error('Stripe return error:', err);
    return res.redirect('/orders');
  }
});

app.post('/stripe/clear-cart', checkAuthenticated, checkCustomer, (req, res) => {
  req.session.cart = [];
  return res.json({ ok: true });
});

// =========================
// NETS QR
// =========================
app.post('/nets-qr/request', checkAuthenticated, checkCustomer, nets.generateQrCode);
app.get('/nets-qr/status', checkAuthenticated, checkCustomer, nets.checkQrStatus);

app.get('/nets-qr/fail', checkAuthenticated, checkCustomer, (req, res) => {
  res.render('netsQrFail', {
    title: 'Error',
    responseCode: 'N.A.',
    instructions: '',
    errorMsg: 'Unable to generate NETS QR. Please try again.'
  });
});

// =========================
// ADMIN ORDER MGMT
// =========================
app.get('/admin/orders', checkAuthenticated, checkAdmin, CartController.adminOrders);
app.get(
  '/admin/orders/:id',
  checkAuthenticated,
  checkAdmin,
  CartController.adminOrderDetails
);

app.post('/admin/orders/:id/refund', checkAuthenticated, checkAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const reason = (req.body.reason || '').trim();

  try {
    const getOrder = util.promisify(Order.getById);
    const getPayment = util.promisify(Payment.getByOrderId);
    const updateOrderStatus = util.promisify(Order.updateStatus);
    const updatePayment = util.promisify(Payment.updateByOrder);

    const orderRows = await getOrder(orderId);
    const order = orderRows && orderRows[0];
    if (!order) {
      req.flash('error', 'Order not found.');
      return res.redirect('/admin/orders');
    }

    const paymentRows = await getPayment(orderId);
    const payment = paymentRows && paymentRows[0];
    if (!payment) {
      req.flash('error', 'Payment record not found.');
      return res.redirect('/admin/orders/' + orderId);
    }

    if (order.status === 'REFUNDED' || payment.status === 'REFUNDED') {
      req.flash('info', 'Order already refunded.');
      return res.redirect('/admin/orders/' + orderId);
    }

    let refundRef = null;
    if (payment.provider === 'stripe') {
      const refund = await stripeService.refundPaymentIntent(payment.provider_ref);
      refundRef = refund && refund.id ? refund.id : null;
    } else if (payment.provider === 'paypal') {
      const refund = await paypal.refundCapture(payment.provider_ref);
      refundRef = refund && refund.id ? refund.id : null;
    } else {
      req.flash('error', 'Refund not supported for this payment method.');
      return res.redirect('/admin/orders/' + orderId);
    }

    const refundedAt = new Date();
    await updateOrderStatus(orderId, 'REFUNDED');
    await updatePayment(orderId, {
      status: 'REFUNDED',
      refundRef,
      refundedAt,
      refundReason: reason || null
    });

    req.flash('success', 'Refund successful.');
    return res.redirect('/admin/orders/' + orderId);
  } catch (err) {
    console.error('Refund error:', err);
    req.flash('error', 'Refund failed.');
    return res.redirect('/admin/orders/' + orderId);
  }
});

// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
