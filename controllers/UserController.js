// controllers/UserController.js
const User = require('../models/User');

// Home page
const home = (req, res) => {
  res.render('index', { user: req.session.user });
};

// Show register form
const showRegister = (req, res) => {
  res.render('register', {
    messages: req.flash('error'),
    formData: req.flash('formData')[0]
  });
};

// Handle register POST
// REGISTER (POST)
const register = (req, res) => {
    const db = require('../db');

    const { username, email, password, address, contact } = req.body;

    // Force all registered users to be normal users
    const role = "user";

    const sql = `
        INSERT INTO users (username, email, password, address, contact, role)
        VALUES (?, ?, SHA1(?), ?, ?, ?)
    `;

    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            console.log(err);
            req.flash('error', 'Registration failed. Try again.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }

        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
};

// Show login form
const showLogin = (req, res) => {
  res.render('login', {
    messages: req.flash('success'),
    errors: req.flash('error')
  });
};

// Handle login POST
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/login');
  }

  User.authenticate(email, password, (err, user) => {
    if (err) {
      console.error('Error authenticating user:', err);
      req.flash('error', 'Login error.');
      return res.redirect('/login');
    }

    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    // successful login
    req.session.user = user;

    if (user.role === 'user') {
      res.redirect('/shopping');
    } else {
      res.redirect('/inventory');
    }
  });
};

// Logout
const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};

module.exports = {
  home,
  showRegister,
  register,
  showLogin,
  login,
  logout
};