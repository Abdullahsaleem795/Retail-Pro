# RetailPro — Inventory & POS for Pakistani SMEs

A multi-tenant SaaS that replaces the paper register (*bahi khata*) used by kiryana stores,
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
- **Backend** — Node.js, Express
- **Database** — PostgreSQL via [Supabase](https://supabase.com) (accessed with the `pg` driver, raw
  parameterized SQL — no ORM)
- **Auth** — JWT access + refresh tokens, bcrypt password hashing
- **Deployment** — Vercel (frontend), Render (backend), Supabase (database)

> **Migration note:** this project originally shipped on MongoDB/Mongoose (see git history before the
> "shift backend to Supabase" commits). The database layer was fully migrated to Postgres; the
> Express API, JWT auth, and permission system were kept as-is, and the frontend needed **zero**
> changes — every API response still returns the same field shapes (`_id`, camelCase keys, populated
> nested objects) the frontend was already built against.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works) — [supabase.com](https://supabase.com)

### 1. Provision the database

In the Supabase SQL Editor (or via `psql`/any Postgres client), run
[`backend/src/db/schema.sql`](backend/src/db/schema.sql) with `{{SCHEMA}}` replaced by `retailpro`:

```bash
sed 's/{{SCHEMA}}/retailpro/g' backend/src/db/schema.sql | psql "<your-connection-string>"
```

This creates a dedicated `retailpro` schema with all 12 tables, indexes, and triggers — isolated from
anything else already living in your Supabase project's `public` schema.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
CLIENT_URL=http://localhost:5173
```

**Use the pooler host**, not `db.<ref>.supabase.co` — Supabase's direct host is IPv6-only, and most
networks (including many CI/sandbox environments) have no outbound IPv6 route, so a direct connection
just times out. Get the pooler string from **Supabase Dashboard → Settings → Database → Connection
Pooling**, "Session" mode, port 5432 (this is a long-running server, not serverless — session mode is
correct; the transaction-mode pooler on 6543 is for short-lived serverless functions).

Generate strong JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Verify the connection, then start the server:

```bash
npm run test:db
npm run dev
```

API runs on `http://localhost:5000`.

### 3. Seed demo data (optional)

```bash
cd backend
npm run seed
```

Creates a demo shop with 18 products, 3 suppliers, 4 customers, and 30 days of sales.

**Login:** `demo@retailpro.pk` / `demo1234`

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App runs on `http://localhost:5173`.

---

## Multi-Tenancy & Data Isolation

Every business table carries a `shop_id`. Isolation is enforced in one place and never trusted from
client input:

1. On login, the JWT is signed with `{ userId, shopId, role }`.
2. `middleware/auth.js` verifies the token, re-loads the user from the database, and sets
   `req.shopId` from the **stored user record** — not from anything in the request.
3. Every controller query includes `shop_id = $N` in its `WHERE` clause. Update statements never let
   the request body reassign `shop_id`.

```js
// Reads and writes are always scoped
const { rows } = await query(
  'UPDATE products SET ... WHERE id = $1 AND shop_id = $2 RETURNING *',
  [req.params.id, req.shopId] // tenant scope in the WHERE, not a post-fetch check
);
```

Because the tenant filter lives in the `WHERE` clause rather than a post-fetch check, a mismatched
`shop_id` returns zero rows ("not found") instead of leaking the existence of another shop's record.

### Schema isolation

RetailPro's tables live in their own dedicated Postgres **schema** (`retailpro`), not `public` — this
matters if your Supabase project hosts anything else, since a `public.users` table from a different
app would otherwise collide with RetailPro's own `users` table. `DATABASE_URL`'s connection carries a
`search_path` set via the `pg` startup options, so every unqualified table name in application code
resolves to the right schema automatically.

### Indexes

Compound indexes are `shop_id`-first so every tenant-scoped query is index-covered and stays fast as
shop count grows:

```
users:     (shop_id, email)         unique
products:  (shop_id, sku)           unique
           (shop_id, barcode)
           (shop_id, name)
           (shop_id, created_at)
           (shop_id, stock_quantity)
sales:     (shop_id, receipt_number) unique
           (shop_id, created_at)
           (shop_id, customer_id)
purchases: (shop_id, created_at), (shop_id, supplier_id), (shop_id, status)
```

---

## Transactional Integrity

Checkout and purchase-receiving touch several tables at once, so both run inside a single Postgres
transaction (`BEGIN`/`COMMIT`/`ROLLBACK` via `withTransaction()` in `config/db.js`). A stock-out
discovered halfway through a sale rolls back the whole thing — you never end up with decremented
stock and no sale record, or a khata balance that doesn't match a receipt.

```js
await withTransaction(async (client) => {
  // SELECT ... FOR UPDATE (row lock) → validate stock → decrement products
  // → update customer credit → insert sale + sale_items
});
```

Line items (`SELECT ... FOR UPDATE`) are row-locked while a sale is being built, so two concurrent
checkouts against the same last unit of stock can't both succeed — the second one blocks until the
first commits, then re-reads the now-correct stock level.

### A cascade-ordering gotcha worth knowing

Deleting a shop cascades through **two independent paths** at once — `shops → products` directly, and
`shops → sales → sale_items` via `sale_id` — with no guaranteed ordering between them. If Postgres
processes the `products` path first, it tries to delete a product a not-yet-deleted `sale_items` row
still references, and the default `RESTRICT` foreign key blocks it — even though that `sale_items` row
is about to be cascade-deleted anyway, just via the other path.

The fix is **not** `ON DELETE CASCADE` on `sale_items.product_id` (that would let deleting a *single*
product silently erase real sales history, which should stay blocked). The fix is
`DEFERRABLE INITIALLY DEFERRED` on that foreign key, which moves the check to transaction-commit time
— after every cascade path has resolved — so it only fires if a genuine dangling reference remains:

```sql
ALTER TABLE sale_items
  ADD CONSTRAINT sale_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id)
    DEFERRABLE INITIALLY DEFERRED;
```

The same pattern applies to `purchase_items.product_id`, `purchases.supplier_id`, and
`sales.cashier_id` — see `src/db/schema.sql` for the full set. This was caught by the seed script's
re-run cleanup (`DELETE FROM shops WHERE ...`) failing with a foreign-key violation, not by a code
review — a reminder that cascade deletes deserve an actual integration test, not just a read of the
DDL.

---

## Testing

```bash
cd backend
npm test
```

Integration tests run against a real, isolated Postgres schema (`retailpro_test`) on the same
Supabase project the app uses — not mocks, and not a different database engine than production, so
transactions, constraints, and cascade behaviour are all genuinely exercised.

- `tests/globalSetup.js` provisions `retailpro_test` once per run from the same
  `src/db/schema.sql` the real `retailpro` schema was built from, so the two can't drift apart.
- `tests/setup.js` truncates every table between individual tests for isolation.
- `tests/globalTeardown.js` drops the schema once the whole run finishes.

Coverage focuses on the paths where a bug costs a shopkeeper real money:

| Suite | What it protects |
|---|---|
| `tenancy.test.js` | One shop cannot read, edit, delete, or sell another shop's data; reports stay scoped |
| `sales.test.js` | Stock decrements correctly, oversell rolls the whole transaction back, prices are snapshotted, khata balances, refunds, purchase receiving |
| `permissions.test.js` | Role gates, individual permission grants, and that a grant can't escalate to shop control |
| `auth.test.js` | Registration validation, login, refresh, password change, no hash leakage |

Two tests exist specifically as regression tripwires for bugs that already happened once:

- *"allows many ordinary sales that carry no clientRef"* — guards the sparse-vs-partial index bug
  described below.
- *"returns 404 (not 403) when reading another shop's product"* — a 403 would confirm the record
  exists, leaking information across tenants.

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

```sql
-- Only real client_refs are indexed - ordinary online sales (client_ref IS NULL)
-- never collide, since Postgres treats every NULL as distinct in a unique index
-- even without a partial filter. The partial index is kept anyway so the intent
-- is explicit rather than relying on that NULL-handling detail implicitly.
CREATE UNIQUE INDEX idx_sales_shop_client_ref ON sales (shop_id, client_ref)
  WHERE client_ref IS NOT NULL;
```

If the same `clientRef` is submitted twice — a genuine offline-sync retry racing a slow response —
the second insert hits this unique constraint (Postgres error `23505`). The sale controller catches
that specific case and returns the row that actually landed instead of a 500, so a retry is always
safe to send.

---

## Security

- **Passwords** — bcrypt, 10 salt rounds; password hashes are only ever selected in the two queries
  that need them (login, change-password), never returned in any API response
- **Tokens** — short-lived access token (15m) + refresh token (7d); frontend refreshes transparently
  via an axios interceptor with request queueing to avoid refresh stampedes
- **Headers** — `helmet` for standard security headers
- **Rate limiting** — 300 req/15min per IP globally, 20 req/15min on login and register
- **Injection** — every query is parameterized (`$1`, `$2`, ...); no string-built SQL anywhere in the
  codebase
- **Validation** — `express-validator` rule chains, enforced by shared `middleware/validate.js`
- **Row-Level Security** — enabled on every RetailPro table with **no policies**, deliberately. The
  Express backend connects with a direct, credentialed Postgres connection (not Supabase's anon/REST
  API), so RLS has no bearing on the app's own access — it's on purely so these tables default-deny
  if the Data API is ever pointed at them.
- **Roles & permissions** — `owner` > `manager` > `cashier` give sensible defaults; the owner can
  additionally grant individual capabilities (e.g. let one trusted cashier record expenses) without
  promoting them. Grants are **additive only** — a subtractive model would let an owner lock
  themselves out of their own shop.
- **Escalation guard** — `staff:manage` and `shop:settings` are deliberately not grantable, so a
  granted permission can never be used to take over the shop. Attempts to set them are dropped
  server-side rather than rejected loudly.
- **Owner protection** — the owner account can't be deleted, demoted, or modified via staff endpoints

---

## API Reference

All endpoints except `/auth/*` require `Authorization: Bearer <accessToken>`.

### Auth
```
POST   /api/auth/register      Create shop + owner account
POST   /api/auth/login         Sign in
POST   /api/auth/refresh       Exchange refresh token for new access token
GET    /api/auth/me            Current user, shop, and effective permissions
PUT    /api/auth/profile       Edit your own name/phone
PUT    /api/auth/password      Change your own password
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

GET   /api/shop                 PUT (shop:settings)
GET   /api/shop/permissions     Grantable permissions + role defaults
GET   /api/shop/users           POST/PUT/DELETE (staff:manage)
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
3. Environment variables: `DATABASE_URL` (Supabase pooler connection string), `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV=production`, plus WhatsApp keys if used
4. Render's outbound traffic is IPv4 — this is exactly why `DATABASE_URL` must use Supabase's pooler
   host, not the IPv6-only direct host

### Frontend → Vercel

1. Import the repo, root directory `frontend`
2. Framework preset: Vite · Build: `npm run build` · Output: `dist`
3. Environment variable: `VITE_API_URL=https://<your-render-service>.onrender.com/api`

After the frontend is live, set `CLIENT_URL` on the backend to the Vercel URL so CORS allows it.

---

## Scaling Notes

Current design comfortably handles thousands of shops on a single backend instance:

- All hot queries are covered by `shop_id`-prefixed compound indexes
- Product and sales lists are paginated
- Reports use SQL aggregation (`GROUP BY`, window-free rollups) rather than loading rows into Node
- Dashboard chunks are lazily loaded so the POS screen (the one used all day) stays ~9 kB

When a single instance is no longer enough:

1. Run several stateless API replicas behind a load balancer, with `DISABLE_SCHEDULER=true` on all
   but one
2. Move the cron jobs into a dedicated worker service
3. Add Redis for report caching (dashboard summaries change slowly)
4. Consider read replicas once the working set exceeds a single Postgres instance's comfortable
   capacity — every query already carries `shop_id`, so range/hash partitioning `shops` and its
   descendants stays straightforward if it's ever needed

---

## Project Structure

```
Retail Pro/
├── backend/
│   ├── server.js                 Entry point, DB connect, scheduler boot
│   └── src/
│       ├── app.js                Express app, middleware, route mounting
│       ├── config/
│       │   ├── db.js             pg.Pool, query()/withTransaction() helpers
│       │   └── permissions.js    Role defaults + grantable permission list
│       ├── db/schema.sql         Canonical DDL - source of truth for both the
│       │                         live `retailpro` schema and the test schema
│       ├── controllers/          One per resource, raw parameterized SQL
│       ├── routes/               Validation chains + permission gates
│       ├── middleware/           auth, validate, errorHandler
│       ├── services/             pdfService, whatsappService, scheduler
│       └── utils/                generateToken, sqlMapper, seed
└── frontend/
    └── src/
        ├── api/                  One module per backend resource
        ├── components/           ProtectedRoute, modals, LanguageSwitch
        ├── context/              AuthContext + useAuth hook
        ├── layouts/               DashboardLayout
        ├── pages/                auth/ and dashboard/
        ├── i18n/                 en.json, ur.json, RTL handling
        └── utils/format.js       PKR currency + date formatting
```
