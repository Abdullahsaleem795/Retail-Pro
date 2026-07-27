# RetailPro — Inventory & POS for Pakistani SMEs

A multi-tenant MERN SaaS that replaces the paper register (*bahi khata*) used by kiryana stores,
general stores, medical stores, and wholesale shops across Pakistan.

Built for shopkeepers who need to know what's selling, what's dead stock, and who owes them money —
without learning accounting software.

---

## Features

| Module | What it does |
|---|---|
| **POS** | Touch/barcode checkout, live cart, discounts, cash/card/JazzCash/EasyPaisa/khata payment |
| **Inventory** | Products with SKU, barcode, Urdu names, cost/selling price, low-stock thresholds |
| **Sales** | Full history, receipt detail, PDF receipts, refunds that restore stock |
| **Purchases** | Purchase orders per supplier, receive-to-stock flow, outstanding balance tracking |
| **Suppliers / Customers** | Contact management, supplier balances, customer *khata* (credit) balances |
| **Expenses** | Categorised shop expenses feeding into net-profit reports |
| **Reports** | Profit & loss, sales trend, best sellers, fast movers, reorder suggestions, low-margin warnings, dead stock |
| **WhatsApp** | Low-stock alerts, daily sales report, weekly profit report, supplier order drafts |
| **Settings** | Shop profile, staff accounts with roles, WhatsApp config, language |
| **Language** | Full English / اردو interface with right-to-left layout |
| **Offline POS** | Sales ring up during an internet outage and sync automatically on reconnect |
| **Barcode** | Hardware wedge scanners, plus camera scanning for phone-based counters |
| **PWA** | Installable on Android, works offline for catalog browsing |

---

## Tech Stack

- **Frontend** — React 19 (Vite), React Router, Context API, Recharts, Framer Motion, react-i18next
- **Backend** — Node.js, Express, Mongoose
- **Database** — MongoDB (Atlas)
- **Auth** — JWT access + refresh tokens, bcrypt password hashing
- **Deployment** — Vercel (frontend), Render (backend), MongoDB Atlas (database)

---

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB database (free [Atlas M0](https://www.mongodb.com/cloud/atlas/register) cluster works)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/retailpro
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
CLIENT_URL=http://localhost:5173
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then start it:

```bash
npm run dev
```

API runs on `http://localhost:5000`.

### 2. Seed demo data (optional)

```bash
cd backend
npm run seed
```

Creates a demo shop with 18 products, 3 suppliers, 4 customers, and 30 days of sales.

**Login:** `demo@retailpro.pk` / `demo1234`

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App runs on `http://localhost:5173`.

---

## Multi-Tenancy & Data Isolation

Every business collection carries a `shopId`. Isolation is enforced in one place and never trusted
from client input:

1. On login, the JWT is signed with `{ userId, shopId, role }`.
2. `middleware/auth.js` verifies the token, re-loads the user from the database, and sets
   `req.shopId` from the **stored user record** — not from anything in the request.
3. Every controller query includes `shopId: req.shopId`. Writes strip any `shopId` in the request
   body so a client can't reassign a record to another tenant.

```js
// Reads and writes are always scoped
const product = await Product.findOneAndUpdate(
  { _id: req.params.id, shopId: req.shopId },  // tenant scope in the filter
  updates,                                      // shopId stripped from body
  { new: true, runValidators: true }
);
```

Because the tenant filter lives in the query filter rather than a post-fetch check, a mismatched
`shopId` returns "not found" instead of leaking the existence of another shop's record.

### Indexes

Compound indexes are `shopId`-first so every tenant-scoped query is index-covered and stays fast as
shop count grows:

```
users:     { shopId, email }        unique
products:  { shopId, sku }          unique
           { shopId, barcode }
           { shopId, name }
           { shopId, createdAt }
           { shopId, stockQuantity }
sales:     { shopId, receiptNumber } unique
           { shopId, createdAt }
           { shopId, customerId }
purchases: { shopId, createdAt }, { shopId, supplierId }, { shopId, status }
```

---

## Transactional Integrity

Checkout and purchase-receiving touch several collections at once, so both run inside MongoDB
transactions. A stock-out discovered halfway through a sale rolls back the whole thing — you never
end up with decremented stock and no sale record, or a khata balance that doesn't match a receipt.

```js
await session.withTransaction(async () => {
  // validate stock → decrement products → update customer credit → insert sale
});
```

> **Note:** transactions require a replica set. Atlas provides this by default. A standalone local
> `mongod` does not — use Atlas, or start local Mongo as a single-node replica set.

---

## Offline Selling

Shops here lose connectivity regularly, and a POS that refuses to ring up a sale during an outage is
worse than the paper register it replaces. So the POS keeps working offline:

1. If a checkout request never reaches the server (no HTTP response at all), the sale is written to
   **IndexedDB** and the cart clears as normal. A server response that *rejects* the sale is not
   queued — replaying a bad sale would be wrong.
2. A banner shows how many sales are waiting, and sync runs on reconnect, on a 60-second safety
   interval, and via a manual "Retry now" button.
3. Sales that fail on sync for a business reason — stock ran out while offline — are removed from the
   queue and surfaced to the shopkeeper to reconcile, rather than retrying forever.

### Idempotency

Every queued sale carries a client-generated `clientRef` (UUID). If a retry crosses with a slow
server response, the server returns the original receipt instead of creating a second one, so stock
is never decremented twice.

The uniqueness index for this deserves a note, because the obvious version is wrong:

```js
// WRONG - in a COMPOUND index, `sparse` only skips a document when EVERY indexed
// field is missing. shopId is always present, so ordinary online sales get
// indexed with clientRef: null and the second one collides.
saleSchema.index({ shopId: 1, clientRef: 1 }, { unique: true, sparse: true });

// CORRECT - only index documents that actually carry a clientRef.
saleSchema.index(
  { shopId: 1, clientRef: 1 },
  { unique: true, partialFilterExpression: { clientRef: { $type: 'string' } } }
);
```

If you ran an earlier build that created the sparse version, drop it before the corrected index can
be built:

```bash
mongosh "<your-uri>" --eval "db.sales.dropIndex('shopId_1_clientRef_1')"
```

---

## Security

- **Passwords** — bcrypt, 10 salt rounds, `select: false` so hashes never leave the database layer
- **Tokens** — short-lived access token (15m) + refresh token (7d); frontend refreshes transparently
  via an axios interceptor with request queueing to avoid refresh stampedes
- **Headers** — `helmet` for standard security headers
- **Rate limiting** — 300 req/15min per IP globally, 20 req/15min on login and register
- **Injection** — `express-mongo-sanitize` strips `$`/`.` operators from user input
- **Validation** — `express-validator` rule chains, enforced by shared `middleware/validate.js`
- **Roles** — `owner` > `manager` > `cashier`; destructive and financial actions are role-gated
- **Owner protection** — the owner account can't be deleted, demoted, or modified via staff endpoints

---

## API Reference

All endpoints except `/auth/*` require `Authorization: Bearer <accessToken>`.

### Auth
```
POST   /api/auth/register      Create shop + owner account
POST   /api/auth/login         Sign in
POST   /api/auth/refresh       Exchange refresh token for new access token
GET    /api/auth/me            Current user
```

### Products & Categories
```
GET    /api/products           ?search= &categoryId= &lowStock= &page= &limit=
POST   /api/products           (owner, manager)
GET    /api/products/:id
PUT    /api/products/:id       (owner, manager)
DELETE /api/products/:id       (owner, manager)
PATCH  /api/products/:id/stock Adjust stock by delta
GET    /api/products/barcode/:barcode
GET    /api/categories         POST / PUT / DELETE
```

### Sales & Purchases
```
GET    /api/sales              ?from= &to= &customerId=
POST   /api/sales              Checkout (transactional, idempotent via clientRef)
GET    /api/sales/:id
GET    /api/sales/:id/receipt  PDF receipt
PATCH  /api/sales/:id/refund   (owner, manager)

GET    /api/purchases          ?status= &supplierId=
POST   /api/purchases          (owner, manager)
PATCH  /api/purchases/:id/receive  Add stock (transactional)
PATCH  /api/purchases/:id/cancel
```

### Contacts & Expenses
```
GET/POST/PUT/DELETE  /api/suppliers
GET/POST/PUT/DELETE  /api/customers
GET/POST/PUT/DELETE  /api/expenses
```

### Reports
```
GET /api/reports/dashboard      Stat-card summary
GET /api/reports/sales-trend    ?days=14
GET /api/reports/profit         ?from= &to=
GET /api/reports/best-sellers   ?limit= &days=
GET /api/reports/dead-stock     ?days=60
GET /api/reports/fast-moving    ?days=30   Units/day + days of stock cover
GET /api/reports/low-margin     ?threshold=15
GET /api/reports/reorder        ?days=30&coverDays=14
```

### Notifications & Shop
```
GET   /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
POST  /api/notifications/send-low-stock            (owner, manager)
POST  /api/notifications/supplier-order/:supplierId (owner, manager)

GET   /api/shop                 PUT (owner)
GET   /api/shop/users           POST/PUT/DELETE (owner)
```

---

## WhatsApp Automation

Uses the **WhatsApp Cloud API** (Meta) rather than Twilio — no per-message markup, which matters on
kiryana margins.

Set in `backend/.env`:

```
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
```

Leave blank during development — messages are logged to the console instead of sent, so nothing
breaks without credentials.

Scheduled jobs (Asia/Karachi):

| Time | Job |
|---|---|
| 08:00 daily | Low-stock alert |
| 21:00 daily | Daily sales report |
| 21:00 Sunday | Weekly profit report |

On multi-replica deployments set `DISABLE_SCHEDULER=true` on all but one instance so reports aren't
sent multiple times.

---

## Deployment

### Backend → Render

1. New Web Service, connect the repo, root directory `backend`
2. Build: `npm install` · Start: `npm start`
3. Environment variables: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`,
   `NODE_ENV=production`, plus WhatsApp keys if used
4. In Atlas → Network Access, allow Render's outbound IPs (or `0.0.0.0/0` if you accept the tradeoff)

### Frontend → Vercel

1. Import the repo, root directory `frontend`
2. Framework preset: Vite · Build: `npm run build` · Output: `dist`
3. Environment variable: `VITE_API_URL=https://<your-render-service>.onrender.com/api`

After the frontend is live, set `CLIENT_URL` on the backend to the Vercel URL so CORS allows it.

---

## Scaling Notes

Current design comfortably handles thousands of shops on a single backend instance:

- All hot queries are covered by `shopId`-prefixed compound indexes
- Product and sales lists are paginated
- Reports use MongoDB aggregation rather than loading documents into Node
- Dashboard chunks are lazily loaded so the POS screen (the one used all day) stays ~9 kB

When a single instance is no longer enough:

1. Run several stateless API replicas behind a load balancer, with `DISABLE_SCHEDULER=true` on all
   but one
2. Move the cron jobs into a dedicated worker service
3. Add Redis for report caching (dashboard summaries change slowly)
4. Consider sharding on `shopId` once the working set exceeds RAM — the schema is already
   shard-ready since every query carries `shopId`

---

## Project Structure

```
Retail Pro/
├── backend/
│   ├── server.js                 Entry point, DB connect, scheduler boot
│   └── src/
│       ├── app.js                Express app, middleware, route mounting
│       ├── config/db.js
│       ├── models/               Shop, User, Category, Product, Supplier,
│       │                         Customer, Sale, Purchase, Expense, Notification
│       ├── controllers/          One per resource
│       ├── routes/               Validation chains + role gates
│       ├── middleware/           auth, validate, errorHandler
│       ├── services/             pdfService, whatsappService, scheduler
│       └── utils/                generateToken, seed
└── frontend/
    └── src/
        ├── api/                  One module per backend resource
        ├── components/           ProtectedRoute, modals, LanguageSwitch
        ├── context/              AuthContext + useAuth hook
        ├── layouts/              DashboardLayout
        ├── pages/                auth/ and dashboard/
        ├── i18n/                 en.json, ur.json, RTL handling
        └── utils/format.js       PKR currency + date formatting
```
