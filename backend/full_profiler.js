require('dotenv').config();
const { query } = require('./src/config/db');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

async function profileApplication() {
  const { rows: users } = await query("SELECT id, shop_id, role FROM users LIMIT 1");
  if (users.length === 0) {
    console.error('No test user');
    process.exit(1);
  }
  const u = users[0];
  const token = jwt.sign({ userId: u.id, shopId: u.shop_id, role: u.role }, process.env.JWT_ACCESS_SECRET || 'dev_access_secret_32bytes_retailpro', { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };

  const endpoints = [
    { name: 'Dashboard Overview', url: 'http://localhost:5000/api/reports/dashboard-overview' },
    { name: 'Dashboard Summary', url: 'http://localhost:5000/api/reports/dashboard' },
    { name: 'Sales Trend (14 days)', url: 'http://localhost:5000/api/reports/sales-trend?days=14' },
    { name: 'Best Sellers (30 days)', url: 'http://localhost:5000/api/reports/best-sellers?limit=5&days=30' },
    { name: 'Products (limit 50)', url: 'http://localhost:5000/api/products?limit=50' },
    { name: 'Products Search', url: 'http://localhost:5000/api/products?search=tea' },
    { name: 'Categories', url: 'http://localhost:5000/api/categories' },
    { name: 'Customers', url: 'http://localhost:5000/api/customers' },
    { name: 'Suppliers', url: 'http://localhost:5000/api/suppliers' },
    { name: 'Expenses', url: 'http://localhost:5000/api/expenses?limit=50' },
    { name: 'Sales History', url: 'http://localhost:5000/api/sales?limit=50' },
    { name: 'Purchases', url: 'http://localhost:5000/api/purchases?limit=50' },
    { name: 'Notifications', url: 'http://localhost:5000/api/notifications' },
    { name: 'Profit Report', url: 'http://localhost:5000/api/reports/profit' },
    { name: 'Reorder Suggestions', url: 'http://localhost:5000/api/reports/reorder' },
  ];

  console.log('=== 🔬 PROFILING APPLICATION PERFORMANCE (COLD vs WARM) ===\n');

  const profilingResults = [];

  for (const ep of endpoints) {
    // Cold test
    const t0 = Date.now();
    let res, text, status;
    try {
      res = await fetch(ep.url, { headers });
      status = res.status;
      text = await res.text();
    } catch (e) {
      status = 'ERR';
      text = '';
    }
    const coldTime = Date.now() - t0;
    const payloadBytes = Buffer.byteLength(text, 'utf8');

    // Warm test
    const t1 = Date.now();
    try {
      res = await fetch(ep.url, { headers });
      await res.text();
    } catch (e) {}
    const warmTime = Date.now() - t1;

    profilingResults.push({
      name: ep.name,
      url: ep.url,
      status,
      coldTime,
      warmTime,
      payloadBytes,
    });

    console.log(`[${status}] ${ep.name.padEnd(25)} | Cold: ${coldTime.toString().padStart(4)}ms | Warm: ${warmTime.toString().padStart(4)}ms | Payload: ${payloadBytes} B`);
  }

  // Measure SQL direct timings
  console.log('\n=== 🗄️ DIRECT DATABASE QUERY PROFILING ===\n');
  const dbQueries = [
    { name: 'Products Listing SQL', sql: 'SELECT * FROM products WHERE shop_id = $1 LIMIT 50', params: [u.shop_id] },
    { name: 'Sales History SQL', sql: 'SELECT * FROM sales WHERE shop_id = $1 LIMIT 50', params: [u.shop_id] },
    { name: 'Sales Items Join SQL', sql: 'SELECT s.*, si.* FROM sales s JOIN sale_items si ON si.sale_id = s.id WHERE s.shop_id = $1 LIMIT 50', params: [u.shop_id] },
    { name: 'Sales Group By Date SQL', sql: "SELECT created_at::date, SUM(total_amount) FROM sales WHERE shop_id = $1 GROUP BY created_at::date", params: [u.shop_id] },
  ];

  for (const dbq of dbQueries) {
    const t0 = Date.now();
    const { rows } = await query(dbq.sql, dbq.params);
    const dt = Date.now() - t0;
    console.log(`DB Query: ${dbq.name.padEnd(25)} | Execution Time: ${dt}ms | Rows Returned: ${rows.length}`);
  }

  fs.writeFileSync('./profiling_data.json', JSON.stringify(profilingResults, null, 2));
  console.log('\nProfiling complete. Data saved to profiling_data.json');
  process.exit(0);
}

profileApplication().catch((err) => {
  console.error(err);
  process.exit(1);
});
