# SupermarketAppMVC

## Stripe Checkout (Test)

1) Stripe CLI:

```
stripe login
stripe listen --forward-to localhost:3000/stripe/webhook
```

2) Test card:

```
4242 4242 4242 4242
```

3) Required env vars:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=http://localhost:3000
```
