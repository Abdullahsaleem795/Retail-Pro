/**
 * Runs ONCE before the entire test run (Jest's globalSetup, a separate
 * process from the test files themselves) to provision an isolated
 * `retailpro_test` schema on the same Supabase project the app actually
 * uses. Built from the same schema.sql the live `retailpro` schema was
 * created from, so tests run against a structurally identical database
 * rather than a hand-maintained approximation of it.
 *
 * This is a real Postgres database on the network, not an in-memory
 * substitute - the previous MongoDB build used mongodb-memory-server, but
 * Supabase's managed Postgres has no local/offline equivalent, and the whole
 * point of a schema-per-purpose approach is that "real Postgres" is cheap to
 * get here: it's the same server, just a different namespace.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const TEST_SCHEMA = 'retailpro_test';

module.exports = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Tests need backend/.env configured with a real Supabase connection string.'
    );
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Drop first in case a previous run crashed before teardown ran
    await client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);

    const template = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    const ddl = template.replaceAll('{{SCHEMA}}', TEST_SCHEMA);
    await client.query(ddl);
  } finally {
    await client.end();
  }
};
