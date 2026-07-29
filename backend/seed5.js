require('dotenv').config();
const { query } = require('./src/config/db');

async function seed() {
  const { rows: shops } = await query('SELECT id, name FROM shops');
  const sampleProducts = [
    { name: 'Tapal Danedar Tea 950g', sku: 'TAP-950', barcode: '896400010101', costPrice: 1250, sellingPrice: 1400, stockQuantity: 45, unit: 'packet', lowStockThreshold: 10 },
    { name: 'Nestle Milkpak 1 Litre Pack of 12', sku: 'NES-1L-12', barcode: '896400020202', costPrice: 3300, sellingPrice: 3600, stockQuantity: 20, unit: 'box', lowStockThreshold: 5 },
    { name: 'Shan Biryani Masala 50g', sku: 'SHN-BIR-50', barcode: '896400030303', costPrice: 110, sellingPrice: 130, stockQuantity: 100, unit: 'packet', lowStockThreshold: 15 },
    { name: 'Dalda Cooking Oil 5 Litre Can', sku: 'DAL-OIL-5L', barcode: '896400040404', costPrice: 2450, sellingPrice: 2650, stockQuantity: 15, unit: 'litre', lowStockThreshold: 4 },
    { name: 'Lux Soft Rose Soap 140g', sku: 'LUX-ROS-140', barcode: '896400050505', costPrice: 120, sellingPrice: 145, stockQuantity: 80, unit: 'pcs', lowStockThreshold: 20 }
  ];

  for (const shop of shops) {
    console.log(`Seeding 5 products for shop: ${shop.name}...`);
    for (const p of sampleProducts) {
      await query(
        `INSERT INTO products (shop_id, name, sku, barcode, cost_price, selling_price, stock_quantity, unit, low_stock_threshold)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (shop_id, sku) DO UPDATE SET
           name = EXCLUDED.name, barcode = EXCLUDED.barcode, cost_price = EXCLUDED.cost_price,
           selling_price = EXCLUDED.selling_price, stock_quantity = EXCLUDED.stock_quantity, unit = EXCLUDED.unit`,
        [shop.id, p.name, p.sku, p.barcode, p.costPrice, p.sellingPrice, p.stockQuantity, p.unit, p.lowStockThreshold]
      );
    }
  }
  console.log('✅ Successfully seeded 5 products for all shops!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
