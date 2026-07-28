const { Pool, types } = require('pg');

// node-postgres deliberately leaves NUMERIC/DECIMAL (OID 1700) as a string by
// default - PKR amounts and stock quantities can't lose precision to a JS
// float during parsing, and NUMERIC can hold values a double can't represent
// exactly. But every price/quantity/balance column in this schema is
// numeric(14,x), and the frontend does real arithmetic on these fields (POS
// totals, margin calculations, toLocaleString formatting) expecting plain
// numbers, exactly like the original Mongoose build always returned. Shop
// financial amounts are nowhere near double precision's ~15-17 significant
// digits, so parsing to a float here restores that parity with no realistic
// precision loss.
types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

// Every table lives in a dedicated schema rather than `public`, because this
// Supabase project already hosts an unrelated app's tables (also called
// `users`, among others). DB_SCHEMA is overridden to `retailpro_test` by the
// Jest test setup so integration tests never touch real shop data.
const schema = process.env.DB_SCHEMA || 'retailpro';

// The pooler host is required, not the direct db.<ref>.supabase.co host:
// Supabase's direct host is IPv6-only, and most hosts/containers (this one
// included) have no outbound IPv6 route, so a direct connection just times
// out with ENOTFOUND/ENODATA. The pooler (Supavisor) is IPv4-reachable.
//
// search_path is set via the libpq startup `options`, not a query fired from
// a 'connect' event handler. A fire-and-forget query on connect races the
// very first query a caller issues on that same client - it surfaced as a
// real "client already executing a query" warning during seeding. Setting it
// as a startup option applies before any application query can run, on
// every connection the pool opens, with no race window.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  options: `-c search_path=${schema},public`,
});

pool.on('error', (err) => {
  console.error(`Unexpected Postgres pool error: ${err.message}`);
});

const connectDB = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT current_database(), now()');
    console.log(`Postgres connected: ${rows[0].current_database} (schema: ${schema})`);
  } finally {
    client.release();
  }
};

const query = (text, params) => pool.query(text, params);

// Mirrors the Mongoose session.withTransaction() pattern the controllers were
// already written around, so BEGIN/COMMIT/ROLLBACK plumbing stays in one
// place instead of being repeated in every transactional controller.
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, connectDB, query, withTransaction, schema };
