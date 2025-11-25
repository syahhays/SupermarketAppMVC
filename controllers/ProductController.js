const Product = require('../models/Product');

// =======================
// LIST ALL PRODUCTS (ADMIN)
// =======================
const inventory = (req, res) => {
    Product.getAll((err, products) => {
        if (err) return res.status(500).send("Error retrieving products");
        res.render('inventory', { products, user: req.session.user });
    });
};

// =======================
// LIST ALL PRODUCTS (USER SHOPPING PAGE)
// =======================
const shopping = (req, res) => {
    Product.getAll((err, products) => {
        if (err) return res.status(500).send("Error retrieving products");
        res.render('shopping', { user: req.session.user, products });
    });
};

// =======================
// SHOW SINGLE PRODUCT
// =======================
const getProduct = (req, res) => {
    const id = req.params.id;

    Product.getById(id, (err, results) => {
        if (err) return res.status(500).send("Error retrieving product");

        if (results.length === 0) {
            return res.status(404).send("Product not found");
        }

        res.render('product', {
            product: results[0],
            user: req.session.user
        });
    });
};

// =======================
// SHOW ADD PRODUCT FORM
// =======================
const addForm = (req, res) => {
    res.render('addProduct', { user: req.session.user });
};

// =======================
// ADD PRODUCT (POST)
// =======================
const addProduct = (req, res) => {
    const { name, quantity, price } = req.body;

    const productData = {
        productName: name,
        quantity: quantity,
        price: price,
        image: req.file ? req.file.filename : null
    };

    Product.add(productData, (err) => {
        if (err) return res.status(500).send('Error adding product');
        res.redirect('/inventory');
    });
};

// =======================
// SHOW UPDATE PRODUCT FORM
// =======================
const updateForm = (req, res) => {
    const id = req.params.id;

    Product.getById(id, (err, results) => {
        if (err) return res.status(500).send("Error retrieving product");

        if (results.length === 0) {
            return res.status(404).send("Product not found");
        }

        res.render('updateProduct', { product: results[0], user: req.session.user });
    });
};

// =======================
// UPDATE PRODUCT (POST)
// =======================
const updateProduct = (req, res) => {
    const id = req.params.id;
    const { name, quantity, price } = req.body;

    const productData = {
        productName: name,
        quantity: quantity,
        price: price,
        image: req.file ? req.file.filename : req.body.currentImage
    };

    Product.update(id, productData, (err) => {
        if (err) return res.status(500).send('Error updating product');
        res.redirect('/inventory');
    });
};

// =======================
// DELETE PRODUCT
// =======================
const deleteProduct = (req, res) => {
    const id = req.params.id;

    Product.delete(id, (err) => {
        if (err) return res.status(500).send('Error deleting product');
        res.redirect('/inventory');
    });
};

// =======================
// ADD TO CART
// =======================
const getProductForCart = (productId, quantity, req, res) => {
    Product.getById(productId, (err, results) => {
        if (err) return res.status(500).send("Error retrieving product");

        if (results.length > 0) {
            const product = results[0];

            if (!req.session.cart) req.session.cart = [];

            const existing = req.session.cart.find(item => item.productId === productId);

            if (existing) {
                existing.quantity += quantity;
            } else {
                req.session.cart.push({
                    productId: product.id,
                    productName: product.productName,
                    price: product.price,
                    quantity: quantity,
                    image: product.image
                });
            }

            return res.redirect('/cart');
        } else {
            return res.status(404).send("Product not found");
        }
    });
};

// =======================
// EXPORT FUNCTIONS
// =======================
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