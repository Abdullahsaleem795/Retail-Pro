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
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');

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
  await connectDB();

  // Scope the wipe to the demo shop only - never touch real tenants
  const existing = await Shop.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const shopId = existing._id;
    await Promise.all([
      User.deleteMany({ shopId }),
      Category.deleteMany({ shopId }),
      Product.deleteMany({ shopId }),
      Supplier.deleteMany({ shopId }),
      Customer.deleteMany({ shopId }),
      Sale.deleteMany({ shopId }),
      Expense.deleteMany({ shopId }),
    ]);
    await Shop.deleteOne({ _id: shopId });
    console.log('Cleared previous demo data');
  }

  const shop = await Shop.create({
    name: 'Al-Madina Kiryana Store',
    businessType: 'kiryana',
    ownerName: 'Abdullah Saleem',
    phone: '03001234567',
    email: DEMO_EMAIL,
    address: 'Main Bazar, Model Town',
    city: 'Lahore',
    whatsappNumber: '923001234567',
  });

  const owner = await User.create({
    shopId: shop._id,
    name: 'Abdullah Saleem',
    email: DEMO_EMAIL,
    password: 'demo1234',
    phone: '03001234567',
    role: 'owner',
  });

  await User.create({
    shopId: shop._id,
    name: 'Kashif (Cashier)',
    email: 'cashier@retailpro.pk',
    password: 'demo1234',
    role: 'cashier',
  });

  const categories = await Category.insertMany(
    CATEGORIES.map((c) => ({ ...c, shopId: shop._id }))
  );
  const categoryMap = Object.fromEntries(categories.map((c) => [c.name, c._id]));

  const suppliers = await Supplier.insertMany(SUPPLIERS.map((s) => ({ ...s, shopId: shop._id })));

  const products = await Product.insertMany(
    PRODUCTS.map((p, i) => ({
      shopId: shop._id,
      categoryId: categoryMap[p.category],
      supplierId: suppliers[i % suppliers.length]._id,
      name: p.name,
      nameUrdu: p.nameUrdu,
      sku: `SKU-${String(i + 1).padStart(4, '0')}`,
      barcode: `890${String(1000000 + i)}`,
      unit: p.unit,
      costPrice: p.cost,
      sellingPrice: p.price,
      stockQuantity: p.stock,
      lowStockThreshold: 10,
    }))
  );

  const customers = await Customer.insertMany(CUSTOMERS.map((c) => ({ ...c, shopId: shop._id })));

  // 30 days of sales so the trend chart and profit report have real shape
  const sales = [];
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
        const lineSubtotal = product.sellingPrice * quantity;
        subtotal += lineSubtotal;
        items.push({
          productId: product._id,
          name: product.name,
          quantity,
          unitPrice: product.sellingPrice,
          costPrice: product.costPrice,
          subtotal: lineSubtotal,
        });
      }

      const useCustomer = Math.random() < 0.3;
      sales.push({
        shopId: shop._id,
        customerId: useCustomer ? customers[randomInt(0, customers.length - 1)]._id : undefined,
        items,
        subtotal,
        discount: 0,
        tax: 0,
        totalAmount: subtotal,
        paymentMethod: ['cash', 'cash', 'cash', 'jazzcash', 'easypaisa'][randomInt(0, 4)],
        amountPaid: subtotal,
        cashierId: owner._id,
        receiptNumber: `RCPT-${saleDate.getTime()}-${n}-${randomInt(100, 999)}`,
        createdAt: saleDate,
        updatedAt: saleDate,
      });
    }
  }
  await Sale.insertMany(sales);

  await Expense.insertMany(
    EXPENSES.map((e) => ({ ...e, shopId: shop._id, createdBy: owner._id, date: new Date() }))
  );

  console.log('\n Demo data seeded successfully\n');
  console.log(`   Shop:      ${shop.name}`);
  console.log(`   Login:     ${DEMO_EMAIL}`);
  console.log(`   Password:  demo1234`);
  console.log(`   Products:  ${products.length}`);
  console.log(`   Sales:     ${sales.length} across 30 days`);
  console.log(`   Suppliers: ${suppliers.length}   Customers: ${customers.length}\n`);

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  await mongoose.connection.close();
  process.exit(1);
});
