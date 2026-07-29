require('dotenv').config();
const { query } = require('./src/config/db');

async function run() {
  const { rows: shops } = await query('SELECT id FROM shops LIMIT 1');
  const shopId = shops[0]?.id;

  console.log('--- 🚀 BENCHMARKING RETAILPRO DATABASE & API QUERIES ---');

  // 1. Fetch products
  const t0 = Date.now();
  const res1 = await query('SELECT * FROM products WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50', [shopId]);
  const dur1 = Date.now() - t0;
  console.log(`1. Fetch 50 Products Query: ${dur1} ms (${res1.rows.length} rows)`);

  // 2. Barcode search
  const t1 = Date.now();
  const res2 = await query('SELECT * FROM products WHERE shop_id = $1 AND barcode = $2', [shopId, '896400010101']);
  const dur2 = Date.now() - t1;
  console.log(`2. Exact Barcode Search Query: ${dur2} ms (${res2.rows.length} rows)`);

  // 3. Sales Report Query
  const t2 = Date.now();
  const res3 = await query('SELECT * FROM sales WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50', [shopId]);
  const dur3 = Date.now() - t2;
  console.log(`3. Fetch 50 Recent Sales Query: ${dur3} ms (${res3.rows.length} rows)`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
