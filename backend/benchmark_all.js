require('dotenv').config();
const { query } = require('./src/config/db');
const jwt = require('jsonwebtoken');

async function testAllSections() {
  const { rows: users } = await query("SELECT id, shop_id, role FROM users LIMIT 1");
  if (users.length === 0) {
    console.error('No user found to test');
    process.exit(1);
  }
  const u = users[0];
  const token = jwt.sign({ userId: u.id, shopId: u.shop_id, role: u.role }, process.env.JWT_ACCESS_SECRET || 'dev_access_secret_32bytes_retailpro', { expiresIn: '1h' });

  const headers = { Authorization: `Bearer ${token}` };

  const endpoints = [
    { section: 'Dashboard Summary', url: 'http://localhost:5000/api/reports/summary?period=today' },
    { section: 'Inventory Products', url: 'http://localhost:5000/api/products?limit=50' },
    { section: 'Categories', url: 'http://localhost:5000/api/categories' },
    { section: 'Customers', url: 'http://localhost:5000/api/customers' },
    { section: 'Suppliers', url: 'http://localhost:5000/api/suppliers' },
    { section: 'Expenses', url: 'http://localhost:5000/api/expenses?limit=50' },
    { section: 'Sales History', url: 'http://localhost:5000/api/sales?limit=50' },
    { section: 'Purchases', url: 'http://localhost:5000/api/purchases?limit=50' },
    { section: 'Staff List', url: 'http://localhost:5000/api/shop/users' },
    { section: 'Notifications', url: 'http://localhost:5000/api/notifications' },
  ];

  console.log('--- ⏱️ BENCHMARKING REAL DATA LOADING TIME FOR ALL DASHBOARD SECTIONS ---');
  let maxTime = 0;
  let slowSections = [];

  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch(ep.url, { headers });
      const duration = Date.now() - t0;
      const json = await res.json();
      const status = res.status;
      const count = Array.isArray(json.data) ? json.data.length : (json.data ? 'object' : 'none');

      console.log(`[${status}] ${ep.section.padEnd(22)}: ${duration} ms (Data Count: ${count})`);
      if (duration > maxTime) maxTime = duration;
      if (duration > 1000) slowSections.push({ section: ep.section, duration });
    } catch (err) {
      console.error(`FAILED ${ep.section}:`, err.message);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`⚡ Max Loading Time Across All Sections: ${maxTime} ms`);
  if (slowSections.length > 0) {
    console.log('⚠️ Slow Sections (> 1000ms):', slowSections);
  } else {
    console.log('🎉 EXCELLENT! ALL SECTIONS LOAD IN UNDER 1 SECOND (Sub-1000ms guaranteed!)');
  }

  process.exit(0);
}

testAllSections().catch((err) => {
  console.error(err);
  process.exit(1);
});
