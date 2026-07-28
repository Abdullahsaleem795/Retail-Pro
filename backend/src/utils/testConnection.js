/**
 * Connectivity smoke test:  node src/utils/testConnection.js
 *
 * Verifies DATABASE_URL authenticates and the retailpro schema exists with
 * all expected tables.
 */
require('dotenv').config();
const { Pool } = require('pg');

const run = async () => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('DATABASE_URL is not set in backend/.env.');
    process.exit(1);
  }

  console.log('Connecting to Postgres...');
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });

  const client = await pool.connect();
  try {
    const version = await client.query('SELECT version(), current_database()');
    console.log(`\nConnected to: ${version.rows[0].current_database}`);
    console.log(version.rows[0].version.split(',')[0]);

    const schema = process.env.DB_SCHEMA || 'retailpro';
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [schema]
    );

    console.log(
      `\nSchema "${schema}" (${tables.rows.length} tables): ${tables.rows.map((t) => t.table_name).join(', ') || '(none - run the migration first)'}`
    );

    console.log('\nConnection test passed.');
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((err) => {
  console.error(`\nConnection failed: ${err.message}`);
  if (/password authentication failed/i.test(err.message)) {
    console.error('-> Check the password in DATABASE_URL (Supabase > Settings > Database).');
  }
  if (/ENOTFOUND|ENODATA|timeout/i.test(err.message)) {
    console.error(
      '-> Use the pooler host (aws-0-<region>.pooler.supabase.com), not db.<ref>.supabase.co - the ' +
        'direct host is IPv6-only and many networks have no outbound IPv6 route.'
    );
  }
  process.exit(1);
});
