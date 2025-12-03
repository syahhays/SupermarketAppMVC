// controllers/UserController.js
const User = require('../models/User');
const db = require('../db');

// Home page
const home = (req, res) => {
  res.render('index'); // user & messages from res.locals
};

// Show register form
const showRegister = (req, res) => {
  res.render('register', {
    formData: req.flash('formData')[0] || {}
  });
};

// REGISTER (POST)
const register = (req, res) => {
  const { username, email, password, address, contact } = req.body;
  const role = 'user'; // force normal user

  const sql = `
    INSERT INTO users (username, email, password, address, contact, role)
    VALUES (?, ?, SHA1(?), ?, ?, ?)
  `;

  db.query(sql, [username, email, password, address, contact, role], (err) => {
    if (err) {
      console.log(err);
      req.flash('error', 'Registration failed. Please try again.');
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
    formData: req.flash('formData')[0] || {}
  });
};

// Handle login POST
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'Email and password are required.');
    return res.redirect('/login');
  }

  User.authenticate(email, password, (err, user) => {
    if (err) {
      console.error('Error authenticating user:', err);
      req.flash('error', 'Login error. Please try again.');
      return res.redirect('/login');
    }

    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    // successful login
    req.session.user = user;
    req.flash('success', `Welcome back, ${user.username}!`);

    if (user.role === 'user') {
      res.redirect('/shopping');
    } else {
      res.redirect('/inventory');
    }
  });
};

// Logout
const logout = (req, res) => {
  // keep session for flash, just clear user
  req.session.user = null;
  req.flash('info', 'You have been logged out.');
  res.redirect('/');
};

module.exports = {
  home,
  showRegister,
  register,
  showLogin,
  login,
  logout
};