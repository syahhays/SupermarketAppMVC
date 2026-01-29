// services/paypal.js
const axios = require('axios');

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await axios.post(
    `${PAYPAL_BASE}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return res.data.access_token;
}

async function createPaypalOrder(amount, currency = 'SGD', returnUrl, cancelUrl) {
  const token = await getAccessToken();

  const res = await axios.post(
    `${PAYPAL_BASE}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2)
          }
        }
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data; // has id
}

async function capturePaypalOrder(paypalOrderId) {
  const token = await getAccessToken();

  const res = await axios.post(
    `${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data;
}

async function refundCapture(captureId) {
  const token = await getAccessToken();

  const res = await axios.post(
    `${PAYPAL_BASE}/v2/payments/captures/${captureId}/refund`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return res.data;
}

module.exports = {
  createPaypalOrder,
  capturePaypalOrder,
  refundCapture
};
