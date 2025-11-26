// models/CartItem.js

// Add or update an item in the session cart
function addItem(cart, product, quantity) {
  if (!Array.isArray(cart)) cart = [];

  const productId = product.id;

  let existing = cart.find(item => item.productId === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId: product.id,
      productName: product.productName,
      price: product.price,
      quantity: quantity,
      image: product.image
    });
  }

  return cart;
}

// Calculate grand total for the cart
function calculateGrandTotal(cart) {
  if (!Array.isArray(cart)) return 0;

  return cart.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
}

module.exports = {
  addItem,
  calculateGrandTotal
};
