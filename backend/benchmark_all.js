require('dotenv').config();
const { query } = require('./src/config/db');
const jwt = require('jsonwebtoken');

async function testDashboardLoading() {
  const { rows: users } = await query("SELECT id, shop_id, role FROM users LIMIT 1");
  const u = users[0];
  const token = jwt.sign({ userId: u.id, shopId: u.shop_id, role: u.role }, process.env.JWT_ACCESS_SECRET || 'dev_access_secret_32bytes_retailpro', { expiresIn: '1h' });
  const headers = { Authorization: `Bearer ${token}` };

  console.log('--- ⏱️ MEASURING SUPERFAST DASHBOARD OVERVIEW LOAD TIME ---');

  const t0 = Date.now();
  const res = await fetch('http://localhost:5000/api/reports/dashboard-overview', { headers });
  const json = await res.json();
  const duration = Date.now() - t0;

  console.log(`[Status: ${res.status}]`);
  console.log(`⚡ TOTAL DASHBOARD DATA LOAD TIME: ${duration} ms`);
  console.log(`- Products in Stock: ${json.data.summary.productsInStock}`);
  console.log(`- Trend points: ${json.data.trend.length}`);
  console.log(`- Best sellers: ${json.data.bestSellers.length}`);

  process.exit(0);
}

testDashboardLoading().catch((err) => {
  console.error(err);
  process.exit(1);
});
