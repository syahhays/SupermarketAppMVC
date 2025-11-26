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

// =========================
// Multer (image upload)
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// =========================
// View Engine + Middleware
// =========================
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());

// =========================
// Authentication Middleware
// =========================
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  req.flash('error', 'Please log in to view this resource');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error', 'Access denied');
  res.redirect('/shopping');
};

// =========================
// Validation Middleware
// =========================
const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;

  if (!username || !email || !password || !address || !contact || !role) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password should be at least 6 characters long');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  next();
};

// =========================
// ROUTES
// =========================

// Home
app.get('/', UserController.home);

// =========================
// PRODUCT ROUTES (MVC)
// =========================
app.get('/inventory', checkAuthenticated, checkAdmin, ProductController.inventory);
app.get('/shopping', checkAuthenticated, ProductController.shopping);
app.get('/product/:id', checkAuthenticated, ProductController.getProduct);

app.get('/addProduct', checkAuthenticated, checkAdmin, ProductController.addForm);
app.post('/addProduct',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  ProductController.addProduct
);

app.get('/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  ProductController.updateForm
);

app.post('/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  ProductController.updateProduct
);

app.get('/deleteProduct/:id',
  checkAuthenticated,
  checkAdmin,
  ProductController.deleteProduct
);

// =========================
// USER ROUTES (MVC)
// =========================
app.get('/register', UserController.showRegister);
app.post('/register', validateRegistration, UserController.register);

app.get('/login', UserController.showLogin);
app.post('/login', UserController.login);

app.get('/logout', UserController.logout);

// =========================
// CART ROUTES (MVC)
// =========================
app.post('/add-to-cart/:id',
  checkAuthenticated,
  CartController.addToCart
);

app.get('/cart',
  checkAuthenticated,
  CartController.viewCart
);

app.get('/checkout', checkAuthenticated, CartController.checkoutPage);

// Update quantity
app.post('/cart/update/:productId', checkAuthenticated, CartController.updateQuantity);

// Remove item
app.get('/cart/remove/:productId', checkAuthenticated, CartController.removeItem);

// Clear cart
app.get('/cart/clear', checkAuthenticated, CartController.clearCart);


// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));