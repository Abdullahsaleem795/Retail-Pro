-- Canonical RetailPro schema DDL. This is the single source of truth: the
-- live `retailpro` schema on Supabase was created from this exact SQL (via
-- three migrations - initial schema, a search_path fix unrelated to DDL, and
-- two FK-deferral fixes now folded in below), and the Jest test suite
-- provisions an isolated `retailpro_test` schema from this same file so the
-- two can never drift apart.
--
-- {{SCHEMA}} is replaced with the target schema name before execution.

CREATE SCHEMA IF NOT EXISTS {{SCHEMA}};

CREATE OR REPLACE FUNCTION {{SCHEMA}}.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = {{SCHEMA}}, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ SHOPS ============
CREATE TABLE {{SCHEMA}}.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'general'
    CHECK (business_type IN ('kiryana','general','medical','wholesale','other')),
  owner_name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  city text,
  logo_url text,
  currency text NOT NULL DEFAULT 'PKR',
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','ur')),
  whatsapp_number text,
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 10,
  subscription_plan text NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free','basic','pro','enterprise')),
  subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','pending_activation','expired','cancelled')),
  subscription_ends_at timestamptz,
  last_payment_trx text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_shops_updated_at BEFORE UPDATE ON {{SCHEMA}}.shops
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ USERS ============
CREATE TABLE {{SCHEMA}}.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- Globally unique, not just per-shop: login() looks a user up by
  -- `WHERE email = $1` with no shop selector in the login form to
  -- disambiguate, so the same email existing under two different shops
  -- makes login non-deterministic (rows[0] with no ORDER BY) and can lock
  -- an owner out of their own account. Proven live before this constraint
  -- existed - see the 2026-08-03 migration comment in this repo's history.
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'cashier' CHECK (role IN ('owner','manager','cashier')),
  permissions text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  -- Quick-switch PIN login for shared shop PCs - see authController.js
  -- pinLogin(). Nullable: opt-in via Profile, most accounts won't have one.
  pin text,
  pin_failed_attempts integer NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, email)
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON {{SCHEMA}}.users
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ CATEGORIES ============
CREATE TABLE {{SCHEMA}}.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_urdu text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON {{SCHEMA}}.categories
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ SUPPLIERS ============
CREATE TABLE {{SCHEMA}}.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text NOT NULL,
  email text,
  address text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_shop_name ON {{SCHEMA}}.suppliers (shop_id, name);
CREATE INDEX idx_suppliers_shop_created ON {{SCHEMA}}.suppliers (shop_id, created_at DESC);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON {{SCHEMA}}.suppliers
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ CUSTOMERS ============
CREATE TABLE {{SCHEMA}}.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  credit_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_shop_name ON {{SCHEMA}}.customers (shop_id, name);
CREATE INDEX idx_customers_shop_phone ON {{SCHEMA}}.customers (shop_id, phone);
CREATE INDEX idx_customers_shop_created ON {{SCHEMA}}.customers (shop_id, created_at DESC);
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON {{SCHEMA}}.customers
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE {{SCHEMA}}.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  category_id uuid REFERENCES {{SCHEMA}}.categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES {{SCHEMA}}.suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  name_urdu text,
  sku text NOT NULL,
  barcode text,
  unit text NOT NULL DEFAULT 'pcs'
    CHECK (unit IN ('pcs','kg','g','litre','ml','dozen','box','packet')),
  cost_price numeric(14,2) NOT NULL CHECK (cost_price >= 0),
  selling_price numeric(14,2) NOT NULL CHECK (selling_price >= 0),
  stock_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold numeric(14,3) NOT NULL DEFAULT 10,
  expiry_date date,
  expiry_alert_days integer CHECK (expiry_alert_days IS NULL OR expiry_alert_days >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, sku)
);
CREATE INDEX idx_products_shop_barcode ON {{SCHEMA}}.products (shop_id, barcode);
CREATE INDEX idx_products_shop_name ON {{SCHEMA}}.products (shop_id, name);
CREATE INDEX idx_products_shop_created ON {{SCHEMA}}.products (shop_id, created_at DESC);
CREATE INDEX idx_products_shop_stock ON {{SCHEMA}}.products (shop_id, stock_quantity);
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON {{SCHEMA}}.products
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ PURCHASES ============
CREATE TABLE {{SCHEMA}}.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  -- DEFERRABLE INITIALLY DEFERRED: see purchase_items.product_id below for why.
  supplier_id uuid NOT NULL REFERENCES {{SCHEMA}}.suppliers(id) DEFERRABLE INITIALLY DEFERRED,
  total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
  invoice_number text,
  created_by uuid REFERENCES {{SCHEMA}}.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_shop_created ON {{SCHEMA}}.purchases (shop_id, created_at DESC);
CREATE INDEX idx_purchases_shop_supplier ON {{SCHEMA}}.purchases (shop_id, supplier_id);
CREATE INDEX idx_purchases_shop_status ON {{SCHEMA}}.purchases (shop_id, status);
CREATE TRIGGER trg_purchases_updated_at BEFORE UPDATE ON {{SCHEMA}}.purchases
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

CREATE TABLE {{SCHEMA}}.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES {{SCHEMA}}.purchases(id) ON DELETE CASCADE,
  -- RESTRICT (default), not CASCADE: deleting a single product that still has
  -- real purchase history should be blocked, not silently erase that history.
  -- DEFERRABLE INITIALLY DEFERRED so a full shop cascade-delete - which hits
  -- shops->products directly AND shops->purchases->purchase_items via a
  -- separate path, with no ordering guarantee between them - can still
  -- resolve: the check only fires at commit time, once every cascade path
  -- has actually finished, and only if a real dangling reference remains.
  product_id uuid NOT NULL REFERENCES {{SCHEMA}}.products(id) DEFERRABLE INITIALLY DEFERRED,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  cost_price numeric(14,2) NOT NULL CHECK (cost_price >= 0)
);
CREATE INDEX idx_purchase_items_purchase ON {{SCHEMA}}.purchase_items (purchase_id);

-- ============ SALES ============
CREATE TABLE {{SCHEMA}}.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES {{SCHEMA}}.customers(id) ON DELETE SET NULL,
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(14,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total_amount numeric(14,2) NOT NULL CHECK (total_amount >= 0),
  payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash','card','credit','jazzcash','easypaisa')),
  amount_paid numeric(14,2) NOT NULL CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','refunded','voided')),
  -- DEFERRABLE INITIALLY DEFERRED: same cascade-ordering reasoning as
  -- purchase_items.product_id, but for shops->users vs shops->sales.
  cashier_id uuid NOT NULL REFERENCES {{SCHEMA}}.users(id) DEFERRABLE INITIALLY DEFERRED,
  receipt_number text NOT NULL,
  -- Offline-sync idempotency key. A plain unique index treats every NULL as
  -- distinct in Postgres, so ordinary online sales (client_ref = NULL) never
  -- collide even without a partial index - it's used anyway so the intent is
  -- explicit and only real client_refs are indexed/checked.
  client_ref text,
  synced_from_offline boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, receipt_number)
);
CREATE INDEX idx_sales_shop_created ON {{SCHEMA}}.sales (shop_id, created_at DESC);
CREATE INDEX idx_sales_shop_customer ON {{SCHEMA}}.sales (shop_id, customer_id);
CREATE INDEX idx_sales_shop_status ON {{SCHEMA}}.sales (shop_id, status);
CREATE UNIQUE INDEX idx_sales_shop_client_ref ON {{SCHEMA}}.sales (shop_id, client_ref)
  WHERE client_ref IS NOT NULL;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON {{SCHEMA}}.sales
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

CREATE TABLE {{SCHEMA}}.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES {{SCHEMA}}.sales(id) ON DELETE CASCADE,
  -- See purchase_items.product_id above - identical reasoning.
  product_id uuid NOT NULL REFERENCES {{SCHEMA}}.products(id) DEFERRABLE INITIALLY DEFERRED,
  name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  cost_price numeric(14,2) NOT NULL CHECK (cost_price >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX idx_sale_items_sale ON {{SCHEMA}}.sale_items (sale_id);
CREATE INDEX idx_sale_items_product ON {{SCHEMA}}.sale_items (product_id);

-- ============ EXPENSES ============
CREATE TABLE {{SCHEMA}}.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('rent','utilities','salaries','transport','maintenance','supplies','other')),
  title text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  note text,
  created_by uuid REFERENCES {{SCHEMA}}.users(id) ON DELETE SET NULL,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_shop_date ON {{SCHEMA}}.expenses (shop_id, date DESC);
CREATE INDEX idx_expenses_shop_category ON {{SCHEMA}}.expenses (shop_id, category);
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON {{SCHEMA}}.expenses
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ NOTIFICATIONS ============
CREATE TABLE {{SCHEMA}}.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('low_stock','daily_report','weekly_report','expiry','payment_due','system','subscription')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','whatsapp')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sent','failed','skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_shop_created ON {{SCHEMA}}.notifications (shop_id, created_at DESC);
CREATE INDEX idx_notifications_shop_unread ON {{SCHEMA}}.notifications (shop_id, is_read);
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON {{SCHEMA}}.notifications
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ BRANCHES ============
CREATE TABLE {{SCHEMA}}.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);
CREATE INDEX idx_branches_shop ON {{SCHEMA}}.branches (shop_id);
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON {{SCHEMA}}.branches
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

-- ============ STOCK TRANSFERS ============
-- Manifest/logistics tracking of stock moved between branches. Deliberately
-- does NOT split products.stock_quantity per branch - that would require
-- rewriting the POS's transactional stock-deduction path (SELECT...FOR
-- UPDATE), which is out of scope here. This is a paper-trail record: "X units
-- moved from Branch A to Branch B", with a received-confirmation step.
CREATE TABLE {{SCHEMA}}.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES {{SCHEMA}}.shops(id) ON DELETE CASCADE,
  from_branch_id uuid NOT NULL REFERENCES {{SCHEMA}}.branches(id) DEFERRABLE INITIALLY DEFERRED,
  to_branch_id uuid NOT NULL REFERENCES {{SCHEMA}}.branches(id) DEFERRABLE INITIALLY DEFERRED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','received','cancelled')),
  notes text,
  created_by uuid REFERENCES {{SCHEMA}}.users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES {{SCHEMA}}.users(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_branch_id <> to_branch_id)
);
CREATE INDEX idx_stock_transfers_shop_created ON {{SCHEMA}}.stock_transfers (shop_id, created_at DESC);
CREATE INDEX idx_stock_transfers_shop_status ON {{SCHEMA}}.stock_transfers (shop_id, status);
CREATE TRIGGER trg_stock_transfers_updated_at BEFORE UPDATE ON {{SCHEMA}}.stock_transfers
  FOR EACH ROW EXECUTE FUNCTION {{SCHEMA}}.set_updated_at();

CREATE TABLE {{SCHEMA}}.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES {{SCHEMA}}.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES {{SCHEMA}}.products(id) DEFERRABLE INITIALLY DEFERRED,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_stock_transfer_items_transfer ON {{SCHEMA}}.stock_transfer_items (transfer_id);

-- ============ PLATFORM PAYMENT ACCOUNTS ============
-- Singleton (id always 1): the platform operator's own JazzCash/EasyPaisa/
-- bank receiving accounts, shown to every shop on the upgrade-request
-- screen. Not per-shop data, so it doesn't belong on the shops table.
-- Editable only via the platform admin console (requirePlatformAdmin).
CREATE TABLE {{SCHEMA}}.platform_payment_accounts (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  jazzcash_title text,
  jazzcash_number text,
  easypaisa_title text,
  easypaisa_number text,
  bank_title text,
  bank_name text,
  bank_iban text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO {{SCHEMA}}.platform_payment_accounts (id) VALUES (1);

-- RLS enabled with intentionally NO policies on every table: this schema is
-- accessed exclusively by the Express backend over a direct, credentialed
-- Postgres connection (not through PostgREST/anon or service_role REST
-- calls), so RLS has no bearing on the app's own access. It's turned on
-- purely so these tables default-deny if ever reached through the Data API.
ALTER TABLE {{SCHEMA}}.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.stock_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE {{SCHEMA}}.platform_payment_accounts ENABLE ROW LEVEL SECURITY;
