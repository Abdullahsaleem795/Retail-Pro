/** Runs ONCE after the entire test run: drops the isolated test schema. */
require('dotenv').config();
const { Client } = require('pg');

module.exports = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS retailpro_test CASCADE');
  } finally {
    await client.end();
  }
};
