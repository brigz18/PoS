# SmartPOS API

Express + MongoDB backend for the SmartPOS frontend (`index.html` / `dashboard.html`).

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in MONGODB_URI and JWT_SECRET
npm run seed               # optional: creates a demo business + login accounts
npm run dev                 # starts on http://localhost:5000 (nodemon)
```

`npm start` runs it without nodemon, for production.

### Folder layout expected by server.js

This server serves the frontend itself from a `frontend/` folder that's a
**sibling** of `backend/`:

```
smartpos/
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   ├── css/style.css
│   └── js/api.js, app.js, auth.js
└── backend/            <- this folder
```

With that layout, everything runs from one origin:
`http://localhost:5000` serves both the UI and `/api/*`, so there are no
CORS headaches in local development. `CLIENT_ORIGIN` in `.env` only
matters if you ever host the frontend somewhere else.

## Demo accounts (after `npm run seed`)

| Role            | Email                   | Password    |
|-----------------|--------------------------|-------------|
| Owner           | admin@smartpos.com       | password123 |
| Manager         | manager@smartpos.com     | password123 |
| Cashier         | cashier@smartpos.com     | password123 |
| Inventory Staff | staff@smartpos.com       | password123 |

## API surface

| Resource   | Base route          | Permission gate                         |
|------------|----------------------|------------------------------------------|
| Auth       | `/api/auth`           | public / self                            |
| Users      | `/api/users`           | `manageEmployees`                       |
| Categories | `/api/categories`      | `manageProducts`                        |
| Products   | `/api/products`        | `manageProducts`                        |
| Customers  | `/api/customers`       | `manageCustomers`                       |
| Suppliers  | `/api/suppliers`       | `manageSuppliers`                       |
| Sales      | `/api/sales`           | `usePOS` (create) / `viewSalesHistory` (read) |
| Inventory  | `/api/inventory`       | `manageInventory`                       |
| Dashboard  | `/api/dashboard`       | `viewDashboard`                         |
| Business   | `/api/business`        | any logged-in account (edit = Owner only) |
| Payments   | `/api/payments`        | public (`checkout`, `plans`) / private (`renew`) |

Every private route also requires an **active subscription**
(`checkSubscriptionActive`) except `auth`, `payments`, and `business` -
those three stay reachable even after a subscription lapses, so the Owner
can always get back in to pay.

## Notes on this implementation

- **No real payment processor.** `paymentController.js` simulates one:
  `checkout` always succeeds if the input looks valid, and produces a
  `Payment` record with a `reference`. That reference is then *consumed*
  exactly once, either by `registerBusiness` (new sign-up) or `renew`
  (existing business), which is what actually creates/extends anything.
  Swapping in a real processor (Stripe, PayMongo, etc.) means replacing
  the body of `checkout` with a real charge call - the consume-once
  reference pattern around it doesn't need to change.
- **Prices are recomputed server-side at checkout**, from the live
  `Product.price`/`costPrice`, not trusted from the request body - the
  cart on the frontend is just a UI convenience, not a source of truth.
- **Email is unique platform-wide**, not per-business - this matches the
  original `userController`/`authController` you provided, which both
  check `User.findOne({ email })` with no business filter.
