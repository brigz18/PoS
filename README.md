# SmartPOS — Full-Stack Point of Sale System

A complete, production-structured POS system:

- **Frontend**: Plain HTML/CSS/JS (no build step) — served directly by the backend
- **Backend**: Node.js + Express REST API
- **Database**: MongoDB (local `mongodb://localhost:27017` or MongoDB Atlas — same code works with either)
- **Auth**: JWT, bcrypt password hashing, Role-Based Access Control (Owner, Manager, Cashier, Inventory Staff)

Everything runs from **one command** — the Express server serves both the API (`/api/*`) and the frontend (`/`), so there's zero CORS configuration to fight with on localhost.

```
smartpos-system/
├── backend/            Express API + Mongoose models + JWT auth
│   ├── config/db.js         MongoDB connection
│   ├── models/               Business, User, Product, Category, Customer, Supplier, Sale, StockMovement
│   ├── middleware/           auth (JWT verify + RBAC), error handler
│   ├── controllers/          business logic per resource
│   ├── routes/                route definitions
│   ├── utils/seed.js         demo data seeder
│   ├── server.js              app entry point (also serves the frontend)
│   └── .env                   your local config (already set up for localhost:27017)
└── frontend/            Plain HTML/CSS/JS, talks to the API via fetch()
    ├── index.html          Landing page, Login, Business Registration
    ├── dashboard.html      The actual POS app (after login)
    ├── css/style.css
    └── js/{api.js, auth.js, app.js}
```

## 1. Prerequisites

- **Node.js 18+** — check with `node -v`
- **MongoDB Community Server 8.2.1**, running locally on `mongodb://localhost:27017`
  (you said you already have this — just make sure the `mongod` service is running)

To confirm MongoDB is running:

```bash
# Windows: check the "MongoDB Server" service is started, or run:
"C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"

# macOS / Linux:
mongosh --eval "db.runCommand({ ping: 1 })"
# should print { ok: 1 }
```

## 2. Install & configure the backend

```bash
cd backend
npm install
```

A `.env` file is already included, pre-configured for your local database:

```
MONGO_URI=mongodb://127.0.0.1:27017/smartpos
JWT_SECRET=smartpos_local_dev_secret_change_this_in_production_5f8a9c2e1b
CLIENT_ORIGIN=http://localhost:5000
```

You don't need to change anything to run it locally. (Do change `JWT_SECRET` before ever deploying this for real use.)

## 3. Seed demo data (optional but recommended)

This creates a demo business with one login for each role:

```bash
npm run seed
```

```
Owner:     admin@smartpos.com     / password123
Manager:   manager@smartpos.com    / password123
Cashier:   cashier@smartpos.com     / password123
Inventory: staff@smartpos.com       / password123
```

## 4. Run it

```bash
npm start
# or, for auto-reload during development:
npm run dev
```

You'll see:
```
MongoDB Connected: 127.0.0.1
SmartPOS API running in development mode on port 5000
```

Now open **http://localhost:5000** in your browser. That's it — frontend, backend, and database are all connected:

- The page you see (`index.html` / `dashboard.html`) is served **by the same Express server** at `/`
- All frontend `fetch()` calls go to `/api/...` on that same server (see `frontend/js/api.js`)
- The API reads/writes to your local MongoDB via Mongoose (see `backend/config/db.js`)

If you didn't run the seed script, click **"Register Your Business"** on the landing page to create your own Owner account from scratch — this is the real production sign-up flow.

## 5. How the pieces connect (the "API code" tying it together)

**Frontend → Backend** (`frontend/js/api.js`):
```js
const API_BASE_URL = window.SMARTPOS_API_BASE_URL || '/api';

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Auth.getToken()) headers.Authorization = `Bearer ${Auth.getToken()}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}
```
Every button/action in `dashboard.html` calls into `Api.*` (e.g. `Api.products.list()`, `Api.sales.create(payload)`), which hits the matching Express route.

**Backend → Database** (`backend/config/db.js`):
```js
const mongoose = require('mongoose');
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI); // mongodb://127.0.0.1:27017/smartpos
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};
```
Called once at boot in `server.js`. Every model (`Product`, `Sale`, `User`, ...) uses that same connection through Mongoose.

**Backend → Frontend** (`backend/server.js`):
```js
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
// ...
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
```
`/api/*` is handled by Express routes; everything else falls through to the static frontend files.

## 6. Subscriptions & payments (GCash, Maya, Cards)

The full paid-subscription flow is implemented:

**Landing page → Payment → Registration**
1. Clicking a plan's "Get Started" button (Starter/Professional/Enterprise) opens the Payment page with that plan pre-selected.
2. The person picks GCash, Maya, or Card and pays.
3. On success, they land on the "Register Your Business" form, which is now unlocked and pre-filled with a proof-of-payment reference.
4. Submitting the form creates the Business + Owner account, using the plan/limits tied to that payment. The payment reference can only ever be used once (enforced server-side).

**Subscription expiry & renewal**
- Every business gets a `subscriptionExpiresAt` date (30 days from the last successful payment).
- If it lapses, the backend returns `402 Payment Required` for every route except `/api/auth/me`, `/api/business`, and `/api/payments/renew` - so an Owner can always see their status and pay, but nothing else works until they do.
- The frontend catches that 402 anywhere in the app and shows a non-dismissable "Subscription Expired" modal to renew.
- Owners can also renew **early** anytime from Settings → Subscription → "Renew Now" (adds 30 days on top of whatever time is left, rather than wasting it).

**⚠️ Important: no real payment processor is connected.**
`simulateProcessPayment()` in `backend/controllers/paymentController.js` does honest format validation (a real-looking card number, a valid PH mobile number, etc.) but does **not** contact GCash, Maya, or any card network, and no real money moves. This is clearly labeled in the UI ("sandbox/demo payment form") so it's never mistaken for the real thing.

To accept real money, the standard option for a Philippine business is **[PayMongo](https://www.paymongo.com)**, since it supports GCash, Maya, and Cards through one API:
1. Create a PayMongo account and get your **live** (or test) API keys.
2. Replace the body of `simulateProcessPayment()` with a real call to PayMongo's Sources API (for GCash/Maya - these need a redirect + webhook, since the customer approves the payment on GCash/Maya's own app/site) or Payment Intents API (for cards - use PayMongo.js on the frontend to tokenize the card so raw card numbers never touch this server, which is a hard PCI-DSS requirement).
3. Add a webhook route (e.g. `POST /api/payments/webhook`) that PayMongo calls when a GCash/Maya payment is approved, and mark that `Payment` document `completed` there instead of instantly in `checkout()`.
4. Everything else - the payment-reference-unlocks-registration/renewal pattern, the Business/Payment models, the expiry enforcement - stays exactly the same.

## 7. Roles & permissions

| Role              | Can do |
|-------------------|--------|
| **Owner**         | Everything, including creating Manager/Cashier/Inventory Staff accounts |
| **Manager**       | Products, Inventory, Customers, Suppliers, Reports, create Cashier/Inventory Staff accounts |
| **Cashier**       | POS terminal, view/add Customers, view own Sales |
| **Inventory Staff** | Products (view/edit), Inventory (stock adjustments) |

Enforced in two places:
1. **Frontend**: `dashboard.html` nav items have `data-roles="..."`; `app.js`'s `applyRoleVisibility()` hides what a role shouldn't see.
2. **Backend** (the real security boundary — never trust the frontend alone): `middleware/auth.js`'s `authorize(...roles)` guards every sensitive route (see `routes/*.js`).

## 8. Switching to MongoDB Atlas later

Nothing in the code needs to change — just swap the connection string in `.env`:

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/smartpos?retryWrites=true&w=majority
```

## 9. API reference (quick list)

```
POST   /api/auth/register-business     Public   - create business + Owner account
POST   /api/auth/login                 Public
GET    /api/auth/me                    Private
PUT    /api/auth/change-password       Private

GET    /api/users                      Owner, Manager        - list employees
POST   /api/users                      Owner, Manager        - create employee
PUT    /api/users/:id                  Owner, Manager        - update employee
PUT    /api/users/:id/reset-password   Owner, Manager
DELETE /api/users/:id                  Owner, Manager

GET/POST/PUT/DELETE  /api/categories
GET/POST/PUT/DELETE  /api/products
GET/POST/PUT/DELETE  /api/customers
GET/POST/PUT/DELETE  /api/suppliers

POST   /api/sales                      Owner, Manager, Cashier   - checkout
GET    /api/sales

GET    /api/inventory                  Owner, Manager, Inventory Staff
GET    /api/inventory/movements
POST   /api/inventory/adjust

GET    /api/dashboard                  Private   - aggregated stats

GET    /api/business                   Private   - view business settings
PUT    /api/business                   Owner     - update name, currency, tax rate, timezone

GET    /api/payments/plans             Public    - pricing/limits catalog
POST   /api/payments/checkout          Public    - pay for a plan (registration or renewal), returns a one-time reference
POST   /api/payments/renew             Owner     - spend a paid reference to extend the business's subscription
```

## 10. Important note for standalone MongoDB (your setup)

Checkout (`POST /api/sales`) does **not** use MongoDB multi-document transactions. Transactions require a replica set (or mongos), and a default local `mongod` install - like `mongodb://localhost:27017` - runs as a single standalone node, which rejects transactions outright. Instead, stock is deducted with atomic, conditional single-document updates (`findOneAndUpdate` with a `stock >= quantity` guard), and if any item in a sale can't be fulfilled, everything already deducted in that request is automatically rolled back before the error is returned. This works correctly on both a standalone `mongod` and a replica set / MongoDB Atlas.

## 11. Troubleshooting

- **"MongoDB connection error"** → make sure `mongod` is actually running and listening on port 27017.
- **Blank page / "Cannot GET /"** → make sure you started the server from inside `backend/` (`npm start`), not by opening `index.html` directly as a file.
- **"Request failed (405)" when logging in / registering** → this means the *frontend* is being served by something other than this backend (e.g. VS Code's "Live Server" extension on port 5500), and it received a POST request it doesn't know how to handle. Fix: either (a) don't use Live Server — just run `npm start` in `backend/` and open **http://localhost:5000** directly, or (b) if you do want to run the frontend separately, `frontend/js/api.js` already points at `http://localhost:5000/api` by default, so just make sure the backend is running on port 5000 and that port is in `CLIENT_ORIGIN` in `backend/.env` (it is, by default).
- **401 errors after a while** → your JWT expired (default 7 days) or `JWT_SECRET` changed; just log in again.
- **Port 5000 already in use** → change `PORT` in `backend/.env` (and update `API_BASE_URL`/`CLIENT_ORIGIN` to match).
