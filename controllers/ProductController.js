// controllers/ProductController.js
const Product = require('../models/Product');

// All valid categories
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

/* =========================================================
   ADMIN — INVENTORY LIST
   ========================================================= */
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

/* =========================================================
   SHOPPING PAGE (respects stock and cart)
   ========================================================= */
const shopping = (req, res) => {
  const q = (req.query.q || '').trim();
  const category = (req.query.category || '').trim();

  // Build map of productId -> qty already in THIS user's cart
  const cart = req.session.cart || [];
  const cartQty = {};
  cart.forEach((item) => {
    const pid = Number(item.productId);
    const qty = Number(item.quantity || 0);
    cartQty[pid] = (cartQty[pid] || 0) + qty;
  });

  // Enrich each product with availableQty + isAvailable
  const enrichProducts = (products) => {
    return (products || []).map((p) => {
      const pid = Number(p.id);
      const dbQty = Number(p.quantity || 0);
      const used = cartQty[pid] || 0;
      const remaining = Math.max(dbQty - used, 0);

      return {
        ...p,
        availableQty: remaining,
        isAvailable: !!p.isActive && remaining > 0
      };
    });
  };

  // CASE 1 — Search
  if (q.length > 0) {
    Product.search(q, (err, products) => {
      if (err) {
        console.error('Search error:', err);
        req.flash('error', 'Error searching products.');
        return res.redirect('/shopping');
      }
      res.render('shopping', {
        products: enrichProducts(products),
        query: q
      });
    });
    return;
  }

  // CASE 2 — Category filter
  if (category.length > 0) {
    Product.getByCategory(category, (err, products) => {
      if (err) {
        console.error('Category filter error:', err);
        req.flash('error', 'Error loading category.');
        return res.redirect('/shopping');
      }
      res.render('shopping', {
        products: enrichProducts(products),
        query: ''
      });
    });
    return;
  }

  // CASE 3 — All products
  Product.getAll((err, products) => {
    if (err) {
      console.error('Product load error:', err);
      req.flash('error', 'Error retrieving products.');
      return res.redirect('/');
    }
    res.render('shopping', {
      products: enrichProducts(products),
      query: ''
    });
  });
};

/* =========================================================
   SINGLE PRODUCT PAGE
   ========================================================= */
const getProduct = (req, res) => {
  Product.getById(req.params.id, (err, results) => {
    if (err || !results || results.length === 0) {
      req.flash('error', 'Product not found.');
      return res.redirect('/inventory');
    }
    res.render('product', { product: results[0] });
  });
};

/* =========================================================
   ADD PRODUCT FORM
   ========================================================= */
const addForm = (req, res) => {
  res.render('addProduct', { categories });
};

/* =========================================================
   ADD PRODUCT
   ========================================================= */
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

/* =========================================================
   UPDATE PRODUCT FORM
   ========================================================= */
const updateForm = (req, res) => {
  Product.getById(req.params.id, (err, rows) => {
    if (err || !rows || rows.length === 0) {
      req.flash('error', 'Product not found.');
      return res.redirect('/inventory');
    }
    res.render('updateProduct', { product: rows[0], categories });
  });
};

/* =========================================================
   UPDATE PRODUCT
   ========================================================= */
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
      return res.redirect(`/updateProduct/${id}`);
    }
    req.flash('success', 'Product updated successfully.');
    res.redirect('/inventory');
  });
};

/* =========================================================
   DISABLE / ENABLE PRODUCT
   ========================================================= */
const disableProduct = (req, res) => {
  const id = req.params.id;

  Product.markInactive(id, (err) => {
    if (err) {
      console.error('Disable product error:', err);
      req.flash('error', 'Error disabling product.');
      return res.redirect('/inventory');
    }
    req.flash('info', 'Product marked as unavailable.');
    res.redirect('/inventory');
  });
};

const enableProduct = (req, res) => {
  const id = req.params.id;

  Product.markActive(id, (err) => {
    if (err) {
      console.error('Enable product error:', err);
      req.flash('error', 'Error enabling product.');
      return res.redirect('/inventory');
    }
    req.flash('success', 'Product marked as active.');
    res.redirect('/inventory');
  });
};

/* =========================================================
   EXPORT
   ========================================================= */
module.exports = {
  inventory,
  shopping,
  getProduct,
  addForm,
  addProduct,
  updateForm,
  updateProduct,
  disableProduct,
  enableProduct
};