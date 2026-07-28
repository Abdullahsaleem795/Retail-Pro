const cron = require('node-cron');
const { query } = require('../config/db');
const { mapRows } = require('../utils/sqlMapper');
const {
  sendTextMessage,
  buildLowStockMessage,
  buildDailySalesMessage,
  buildWeeklyProfitMessage,
} = require('./whatsappService');

const TIMEZONE = 'Asia/Karachi';

const recordAndSend = async (shop, { type, title, message }) => {
  const target = shop.whatsapp_number || shop.phone;
  let deliveryStatus = 'sent';
  try {
    const result = await sendTextMessage(target, message);
    if (result?.skipped) deliveryStatus = 'skipped';
  } catch (err) {
    deliveryStatus = 'failed';
    console.error(`[scheduler] ${type} failed for shop ${shop.id}: ${err.message}`);
  }
  await query(
    `INSERT INTO notifications (shop_id, type, title, message, channel, delivery_status)
     VALUES ($1,$2,$3,$4,'whatsapp',$5)`,
    [shop.id, type, title, message, deliveryStatus]
  );
};

// Iterates every active shop. Each shop's data stays isolated by shopId - the
// scheduler never aggregates across tenants.
const forEachActiveShop = async (handler) => {
  const { rows: shops } = await query('SELECT * FROM shops WHERE is_active = true');
  for (const shop of shops) {
    try {
      await handler(shop);
    } catch (err) {
      console.error(`[scheduler] shop ${shop.id} failed: ${err.message}`);
    }
  }
};

const runLowStockCheck = async () => {
  await forEachActiveShop(async (shop) => {
    const { rows } = await query(
      `SELECT name, stock_quantity, unit FROM products
       WHERE shop_id = $1 AND is_active = true AND stock_quantity <= low_stock_threshold`,
      [shop.id]
    );
    if (rows.length === 0) return;

    const lowStock = mapRows(rows);
    await recordAndSend(shop, {
      type: 'low_stock',
      title: `${lowStock.length} items low on stock`,
      message: buildLowStockMessage(shop.name, lowStock),
    });
  });
};

const runDailySalesReport = async () => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();

  await forEachActiveShop(async (shop) => {
    const [salesResult, expenseResult] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(si.subtotal),0) AS revenue, COALESCE(SUM(si.cost_price*si.quantity),0) AS cost,
                COUNT(DISTINCT s.id) AS receipts
         FROM sales s JOIN sale_items si ON si.sale_id = s.id
         WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at BETWEEN $2 AND $3`,
        [shop.id, dayStart, dayEnd]
      ),
      query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id = $1 AND date BETWEEN $2 AND $3`, [
        shop.id,
        dayStart,
        dayEnd,
      ]),
    ]);

    const revenue = Number(salesResult.rows[0].revenue);
    if (revenue === 0) return; // nothing sold today, don't spam the owner

    const cogs = Number(salesResult.rows[0].cost);
    const expenses = Number(expenseResult.rows[0].total);
    const grossProfit = revenue - cogs;

    await recordAndSend(shop, {
      type: 'daily_report',
      title: 'Daily sales report',
      message: buildDailySalesMessage(shop.name, {
        date: dayStart.toLocaleDateString('en-PK'),
        totalSales: revenue,
        transactions: Number(salesResult.rows[0].receipts),
        grossProfit,
        expenses,
        netProfit: grossProfit - expenses,
      }),
    });
  });
};

const runWeeklyProfitReport = async () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);

  await forEachActiveShop(async (shop) => {
    const [salesResult, expenseResult] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(si.subtotal),0) AS revenue, COALESCE(SUM(si.cost_price*si.quantity),0) AS cost
         FROM sales s JOIN sale_items si ON si.sale_id = s.id
         WHERE s.shop_id = $1 AND s.status = 'completed' AND s.created_at BETWEEN $2 AND $3`,
        [shop.id, from, to]
      ),
      query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE shop_id = $1 AND date BETWEEN $2 AND $3`, [
        shop.id,
        from,
        to,
      ]),
    ]);

    const revenue = Number(salesResult.rows[0].revenue);
    if (revenue === 0) return;

    const cogs = Number(salesResult.rows[0].cost);
    const expenses = Number(expenseResult.rows[0].total);
    const grossProfit = revenue - cogs;

    await recordAndSend(shop, {
      type: 'weekly_report',
      title: 'Weekly profit report',
      message: buildWeeklyProfitMessage(shop.name, {
        from: from.toLocaleDateString('en-PK'),
        to: to.toLocaleDateString('en-PK'),
        revenue,
        cogs,
        grossProfit,
        expenses,
        netProfit: grossProfit - expenses,
      }),
    });
  });
};

const startScheduler = () => {
  // 9:00 PM PKT daily - after most shops close, so the report covers a full day
  cron.schedule('0 21 * * *', runDailySalesReport, { timezone: TIMEZONE });

  // 8:00 AM PKT daily - low stock alert before the owner heads to the market
  cron.schedule('0 8 * * *', runLowStockCheck, { timezone: TIMEZONE });

  // 9:00 PM PKT every Sunday - weekly profit wrap-up
  cron.schedule('0 21 * * 0', runWeeklyProfitReport, { timezone: TIMEZONE });

  console.log(`Scheduler started (${TIMEZONE}): daily sales 21:00, low stock 08:00, weekly profit Sun 21:00`);
};

module.exports = { startScheduler, runLowStockCheck, runDailySalesReport, runWeeklyProfitReport };
