/**
 * Demo data seeder.
 *
 *   npm run seed
 *
 * Creates one demo shop with realistic Pakistani kiryana-store inventory,
 * suppliers, customers, and 30 days of randomised sales so the dashboard and
 * reports have something meaningful to show on first run.
 *
 * Safe to re-run: it wipes only the demo shop's data, never other tenants'.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../config/db');

const DEMO_EMAIL = 'demo@retailpro.pk';

const CATEGORIES = [
  { name: 'Grocery', nameUrdu: 'گروسری' },
  { name: 'Beverages', nameUrdu: 'مشروبات' },
  { name: 'Dairy', nameUrdu: 'ڈیری' },
  { name: 'Snacks', nameUrdu: 'اسنیکس' },
  { name: 'Household', nameUrdu: 'گھریلو اشیاء' },
];

const PRODUCTS = [
  { name: 'Basmati Rice 5kg', nameUrdu: 'باسمتی چاول', category: 'Grocery', cost: 1450, price: 1650, stock: 40, unit: 'packet' },
  { name: 'Wheat Flour 10kg', nameUrdu: 'آٹا', category: 'Grocery', cost: 1100, price: 1250, stock: 35, unit: 'packet' },
  { name: 'Cooking Oil 5L', nameUrdu: 'کوکنگ آئل', category: 'Grocery', cost: 2300, price: 2600, stock: 25, unit: 'box' },
  { name: 'Sugar 1kg', nameUrdu: 'چینی', category: 'Grocery', cost: 140, price: 165, stock: 80, unit: 'kg' },
  { name: 'Red Chilli Powder 200g', nameUrdu: 'لال مرچ', category: 'Grocery', cost: 180, price: 220, stock: 6, unit: 'packet' },
  { name: 'Tea Leaves 950g', nameUrdu: 'چائے کی پتی', category: 'Beverages', cost: 1250, price: 1450, stock: 18, unit: 'packet' },
  { name: 'Cola 1.5L', nameUrdu: 'کولا', category: 'Beverages', cost: 130, price: 160, stock: 60, unit: 'pcs' },
  { name: 'Mineral Water 1.5L', nameUrdu: 'منرل واٹر', category: 'Beverages', cost: 45, price: 70, stock: 100, unit: 'pcs' },
  { name: 'Fresh Milk 1L', nameUrdu: 'دودھ', category: 'Dairy', cost: 180, price: 210, stock: 30, unit: 'litre' },
  { name: 'Yogurt 500g', nameUrdu: 'دہی', category: 'Dairy', cost: 110, price: 140, stock: 4, unit: 'packet' },
  { name: 'Butter 200g', nameUrdu: 'مکھن', category: 'Dairy', cost: 320, price: 380, stock: 15, unit: 'packet' },
  { name: 'Potato Chips 60g', nameUrdu: 'چپس', category: 'Snacks', cost: 45, price: 60, stock: 90, unit: 'packet' },
  { name: 'Biscuits Family Pack', nameUrdu: 'بسکٹ', category: 'Snacks', cost: 120, price: 150, stock: 55, unit: 'packet' },
  { name: 'Instant Noodles', nameUrdu: 'نوڈلز', category: 'Snacks', cost: 40, price: 55, stock: 120, unit: 'packet' },
  { name: 'Washing Powder 1kg', nameUrdu: 'واشنگ پاؤڈر', category: 'Household', cost: 380, price: 450, stock: 22, unit: 'packet' },
  { name: 'Dish Soap 500ml', nameUrdu: 'برتن دھونے کا صابن', category: 'Household', cost: 190, price: 240, stock: 3, unit: 'pcs' },
  { name: 'Bath Soap', nameUrdu: 'نہانے کا صابن', category: 'Household', cost: 95, price: 130, stock: 70, unit: 'pcs' },
  { name: 'Toothpaste 150g', nameUrdu: 'ٹوتھ پیسٹ', category: 'Household', cost: 220, price: 280, stock: 28, unit: 'pcs' },
];

const SUPPLIERS = [
  { name: 'Al-Karam Traders', contactPerson: 'Bilal Ahmed', phone: '03001234567', address: 'Jodia Bazar, Karachi' },
  { name: 'Shaheen Distributors', contactPerson: 'Usman Khan', phone: '03217654321', address: 'Akbari Mandi, Lahore' },
  { name: 'Punjab Wholesale', contactPerson: 'Rashid Ali', phone: '03339876543', address: 'Faisalabad' },
];

const CUSTOMERS = [
  { name: 'Ahmed Raza', phone: '03011112222' },
  { name: 'Fatima Bibi', phone: '03123334444' },
  { name: 'Muhammad Yousaf', phone: '03335556666' },
  { name: 'Ayesha Siddiqui', phone: '03447778888' },
];

const EXPENSES = [
  { title: 'Shop Rent', category: 'rent', amount: 35000 },
  { title: 'Electricity Bill', category: 'utilities', amount: 12500 },
  { title: 'Helper Salary', category: 'salaries', amount: 25000 },
  { title: 'Delivery Van Fuel', category: 'transport', amount: 6500 },
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seed = async () => {
  const existing = await pool.query('SELECT id FROM shops WHERE email = $1', [DEMO_EMAIL]);
  if (existing.rows.length > 0) {
    // ON DELETE CASCADE on every child table's shop_id FK means this one
    // delete clears users, categories, products, suppliers, customers,
    // sales (+ items), purchases (+ items), expenses, and notifications.
    await pool.query('DELETE FROM shops WHERE id = $1', [existing.rows[0].id]);
    console.log('Cleared previous demo data');
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);

  const seeded = await withTransaction(async (client) => {
    const shopResult = await client.query(
      `INSERT INTO shops (name, business_type, owner_name, phone, email, address, city, whatsapp_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      ['Al-Madina Kiryana Store', 'kiryana', 'Abdullah Saleem', '03001234567', DEMO_EMAIL,
       'Main Bazar, Model Town', 'Lahore', '923001234567']
    );
    const shopId = shopResult.rows[0].id;

    const ownerResult = await client.query(
      `INSERT INTO users (shop_id, name, email, password, phone, role)
       VALUES ($1,$2,$3,$4,$5,'owner') RETURNING id`,
      [shopId, 'Abdullah Saleem', DEMO_EMAIL, passwordHash, '03001234567']
    );
    const ownerId = ownerResult.rows[0].id;

    await client.query(
      `INSERT INTO users (shop_id, name, email, password, role) VALUES ($1,$2,$3,$4,'cashier')`,
      [shopId, 'Kashif (Cashier)', 'cashier@retailpro.pk', passwordHash]
    );

    const categoryMap = {};
    for (const c of CATEGORIES) {
      const { rows } = await client.query(
        `INSERT INTO categories (shop_id, name, name_urdu) VALUES ($1,$2,$3) RETURNING id`,
        [shopId, c.name, c.nameUrdu]
      );
      categoryMap[c.name] = rows[0].id;
    }

    const supplierIds = [];
    for (const s of SUPPLIERS) {
      const { rows } = await client.query(
        `INSERT INTO suppliers (shop_id, name, contact_person, phone, address) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [shopId, s.name, s.contactPerson, s.phone, s.address]
      );
      supplierIds.push(rows[0].id);
    }

    const products = [];
    for (let i = 0; i < PRODUCTS.length; i += 1) {
      const p = PRODUCTS[i];
      const { rows } = await client.query(
        `INSERT INTO products
           (shop_id, category_id, supplier_id, name, name_urdu, sku, barcode, unit,
            cost_price, selling_price, stock_quantity, low_stock_threshold)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,10)
         RETURNING id, name, cost_price, selling_price`,
        [
          shopId, categoryMap[p.category], supplierIds[i % supplierIds.length], p.name, p.nameUrdu,
          `SKU-${String(i + 1).padStart(4, '0')}`, `890${String(1000000 + i)}`, p.unit, p.cost, p.price, p.stock,
        ]
      );
      products.push(rows[0]);
    }

    const customerIds = [];
    for (const c of CUSTOMERS) {
      const { rows } = await client.query(
        `INSERT INTO customers (shop_id, name, phone) VALUES ($1,$2,$3) RETURNING id`,
        [shopId, c.name, c.phone]
      );
      customerIds.push(rows[0].id);
    }

    // 30 days of sales so the trend chart and profit report have real shape
    let saleCount = 0;
    for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - daysAgo);

      for (let n = 0; n < randomInt(3, 12); n += 1) {
        const lineCount = randomInt(1, 4);
        const items = [];
        let subtotal = 0;

        for (let l = 0; l < lineCount; l += 1) {
          const product = products[randomInt(0, products.length - 1)];
          const quantity = randomInt(1, 3);
          const lineSubtotal = Number(product.selling_price) * quantity;
          subtotal += lineSubtotal;
          items.push({
            productId: product.id,
            name: product.name,
            quantity,
            unitPrice: product.selling_price,
            costPrice: product.cost_price,
            subtotal: lineSubtotal,
          });
        }

        const useCustomer = Math.random() < 0.3;
        const receiptNumber = `RCPT-${saleDate.getTime()}-${n}-${randomInt(100, 999)}`;
        const paymentMethod = ['cash', 'cash', 'cash', 'jazzcash', 'easypaisa'][randomInt(0, 4)];

        const saleResult = await client.query(
          `INSERT INTO sales
             (shop_id, customer_id, subtotal, discount, tax, total_amount, payment_method,
              amount_paid, cashier_id, receipt_number, created_at, updated_at)
           VALUES ($1,$2,$3,0,0,$3,$4,$3,$5,$6,$7,$7)
           RETURNING id`,
          [
            shopId, useCustomer ? customerIds[randomInt(0, customerIds.length - 1)] : null, subtotal,
            paymentMethod, ownerId, receiptNumber, saleDate,
          ]
        );
        const saleId = saleResult.rows[0].id;

        for (const item of items) {
          await client.query(
            `INSERT INTO sale_items (sale_id, product_id, name, quantity, unit_price, cost_price, subtotal)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [saleId, item.productId, item.name, item.quantity, item.unitPrice, item.costPrice, item.subtotal]
          );
        }
        saleCount += 1;
      }
    }

    for (const e of EXPENSES) {
      await client.query(
        `INSERT INTO expenses (shop_id, category, title, amount, created_by) VALUES ($1,$2,$3,$4,$5)`,
        [shopId, e.category, e.title, e.amount, ownerId]
      );
    }

    return { shopId, productsCount: products.length, salesCount: saleCount, supplierCount: supplierIds.length, customerCount: customerIds.length };
  });

  console.log('\n Demo data seeded successfully\n');
  console.log(`   Shop:      Al-Madina Kiryana Store`);
  console.log(`   Login:     ${DEMO_EMAIL}`);
  console.log(`   Password:  demo1234`);
  console.log(`   Products:  ${seeded.productsCount}`);
  console.log(`   Sales:     ${seeded.salesCount} across 30 days`);
  console.log(`   Suppliers: ${seeded.supplierCount}   Customers: ${seeded.customerCount}\n`);

  await pool.end();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  await pool.end().catch(() => {});
  process.exit(1);
});
