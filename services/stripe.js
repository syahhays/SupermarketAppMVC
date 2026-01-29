const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20'
});

const createPaymentIntent = async ({ cart, user, localOrderId }) => {
  const TAX_RATE = 0.07;
  const SHIPPING_FLAT = 5.0;

  const subtotal = (cart || []).reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  const tax = subtotal * TAX_RATE;
  const shipping = cart && cart.length ? SHIPPING_FLAT : 0;
  const total = subtotal + tax + shipping;

  return stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: 'sgd',
    payment_method_types: ['card', 'paynow'],
    metadata: {
      localOrderId: String(localOrderId),
      userId: user && user.id ? String(user.id) : ''
    }
  });
};

const retrievePaymentIntent = async (paymentIntentId) => {
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

const refundPaymentIntent = async (paymentIntentId) => {
  return stripe.refunds.create({ payment_intent: paymentIntentId });
};

const constructEvent = (payload, signature) => {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  );
};

module.exports = {
  createPaymentIntent,
  retrievePaymentIntent,
  refundPaymentIntent,
  constructEvent
};
