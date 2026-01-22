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

// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));