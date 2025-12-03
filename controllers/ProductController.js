const Product = require('../models/Product');

// Define all valid categories
const categories = [
  'fresh-produce',
  'meat-poultry',
  'seafood',
  'dairy-eggs',
  'frozen',
  'beverages',
  'snacks',
  'household',
  'bakery'
];

// =======================
// LIST ALL PRODUCTS (ADMIN)
// =======================
const inventory = (req, res) => {
  Product.getAll((err, products) => {
    if (err) {
      console.error('Inventory error:', err);
      req.flash('error', 'Error retrieving products.');
      return res.redirect('/');
    }
    res.render('inventory', { products });
  });
};

// =======================
// LIST ALL PRODUCTS (USER SHOPPING PAGE)
// =======================
const shopping = (req, res) => {
  const q = (req.query.q || '').trim();
  const category = (req.query.category || '').trim();

  // Case 1: Search
  if (q.length > 0) {
    Product.search(q, (err, products) => {
      if (err) {
        console.error('Search error:', err);
        req.flash('error', 'Error searching products.');
        return res.redirect('/shopping');
      }
      res.render('shopping', { products, query: q });
    });
    return;
  }

  // Case 2: Category filter
  if (category.length > 0) {
    Product.getByCategory(category, (err, products) => {
      if (err) {
        console.error('Category filter error:', err);
        req.flash('error', 'Error retrieving products by category.');
        return res.redirect('/shopping');
      }
      res.render('shopping', { products, query: '' });
    });
    return;
  }

  // Case 3: No filter
  Product.getAll((err, products) => {
    if (err) {
      console.error('Product list error:', err);
      req.flash('error', 'Error retrieving products.');
      return res.redirect('/shopping');
    }
    res.render('shopping', { products, query: '' });
  });
};

// =======================
// SHOW SINGLE PRODUCT
// =======================
const getProduct = (req, res) => {
  Product.getById(req.params.id, (err, results) => {
    if (err) {
      console.error('Get product error:', err);
      req.flash('error', 'Error retrieving product.');
      return res.redirect('/inventory');
    }
    if (results.length === 0) {
      req.flash('error', 'Product not found.');
      return res.redirect('/inventory');
    }

    res.render('product', {
      product: results[0]
    });
  });
};

// =======================
// SHOW ADD PRODUCT FORM
// =======================
const addForm = (req, res) => {
  res.render('addProduct', {
    categories
  });
};

// =======================
// ADD PRODUCT
// =======================
const addProduct = (req, res) => {
  const data = {
    productName: req.body.name,
    quantity: Number(req.body.quantity || 0),
    price: Number(req.body.price || 0),
    image: req.file ? req.file.filename : null,
    category: req.body.category || null
  };

  Product.add(data, (err) => {
    if (err) {
      console.error('Add product error:', err);
      req.flash('error', 'Error adding product.');
      return res.redirect('/addProduct');
    }
    req.flash('success', 'Product added successfully.');
    res.redirect('/inventory');
  });
};

// =======================
// SHOW UPDATE PRODUCT FORM
// =======================
const updateForm = (req, res) => {
  Product.getById(req.params.id, (err, rows) => {
    if (err) {
      console.error('Load product error:', err);
      req.flash('error', 'Error loading product.');
      return res.redirect('/inventory');
    }
    if (!rows.length) {
      req.flash('error', 'Product not found.');
      return res.redirect('/inventory');
    }

    res.render('updateProduct', {
      product: rows[0],
      categories
    });
  });
};

// =======================
// UPDATE PRODUCT
// =======================
const updateProduct = (req, res) => {
  const id = req.params.id;
  const data = {
    productName: req.body.name,
    quantity: Number(req.body.quantity || 0),
    price: Number(req.body.price || 0),
    image: req.file ? req.file.filename : req.body.existingImage,
    category: req.body.category || null
  };

  Product.update(id, data, (err) => {
    if (err) {
      console.error('Update product error:', err);
      req.flash('error', 'Error updating product.');
      return res.redirect('/updateProduct/' + id);
    }
    req.flash('success', 'Product updated successfully.');
    res.redirect('/inventory');
  });
};

// =======================
// DELETE PRODUCT
// =======================
const deleteProduct = (req, res) => {
  Product.delete(req.params.id, (err) => {
    if (err) {
      console.error('Delete product error:', err);
      req.flash('error', 'Error deleting product.');
      return res.redirect('/inventory');
    }
    req.flash('info', 'Product deleted.');
    res.redirect('/inventory');
  });
};

// =======================
// ADD TO CART (utility if needed elsewhere)
// =======================
const getProductForCart = (productId, quantity, req, res) => {
  Product.getById(productId, (err, results) => {
    if (err) {
      console.error('Get product for cart error:', err);
      req.flash('error', 'Error retrieving product.');
      return res.redirect('/shopping');
    }
    if (!results.length) {
      req.flash('error', 'Product not found.');
      return res.redirect('/shopping');
    }

    const product = results[0];

    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find((item) => item.productId === productId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      req.session.cart.push({
        productId: product.id,
        productName: product.productName,
        price: product.price,
        quantity,
        image: product.image
      });
    }

    req.flash('success', `${product.productName} added to cart.`);
    res.redirect('/cart');
  });
};

module.exports = {
  inventory,
  shopping,
  getProduct,
  addForm,
  addProduct,
  updateForm,
  updateProduct,
  deleteProduct,
  getProductForCart
};