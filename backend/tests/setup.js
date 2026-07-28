/**
 * Per-test-file lifecycle. The `retailpro_test` schema itself is created
 * once in globalSetup.js (not here) - this file only needs to isolate tests
 * from each other and clean up this file's own database connection.
 *
 * Jest gives each test file its own module registry, so each file's
 * `require('../src/config/db')` creates a genuinely separate `pg.Pool`
 * instance. Each file is therefore responsible for closing its own pool in
 * afterAll, or Jest hangs waiting for the open TCP handle.
 */
const { pool, query } = require('../src/config/db');

afterEach(async () => {
  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`
  );
  if (rows.length === 0) return;

  // CASCADE handles the FK relationships between these tables regardless of
  // listing order; multi-table TRUNCATE is atomic, so this can't leave a
  // half-cleared schema between tests.
  const tableList = rows.map((r) => `"${r.table_name}"`).join(', ');
  await query(`TRUNCATE ${tableList} CASCADE`);
});

afterAll(async () => {
  await pool.end();
});
