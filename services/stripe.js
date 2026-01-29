const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

const createCheckoutSession = async ({ cart, user, localOrderId, baseUrl }) => {
  const TAX_RATE = 0.07;
  const SHIPPING_FLAT = 5.0;

  const subtotal = (cart || []).reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  const tax = subtotal * TAX_RATE;
  const shipping = cart && cart.length ? SHIPPING_FLAT : 0;

  const lineItems = (cart || []).map((item) => {
    const unitAmount = Math.round(Number(item.price || 0) * 100);
    return {
      price_data: {
        currency: 'sgd',
        product_data: {
          name: item.productName || 'Item'
        },
        unit_amount: unitAmount
      },
      quantity: Number(item.quantity || 0)
    };
  });

  if (shipping > 0) {
    lineItems.push({
      price_data: {
        currency: 'sgd',
        product_data: { name: 'Shipping' },
        unit_amount: Math.round(shipping * 100)
      },
      quantity: 1
    });
  }

  if (tax > 0) {
    lineItems.push({
      price_data: {
        currency: 'sgd',
        product_data: { name: 'Tax' },
        unit_amount: Math.round(tax * 100)
      },
      quantity: 1
    });
  }

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    metadata: {
      localOrderId: String(localOrderId),
      userId: user && user.id ? String(user.id) : ''
    },
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/checkout`
  });
};

const constructEvent = (payload, signature) => {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  );
};

module.exports = {
  createCheckoutSession,
  constructEvent
};
