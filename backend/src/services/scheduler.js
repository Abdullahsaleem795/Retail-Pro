const cron = require('node-cron');
const mongoose = require('mongoose');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Notification = require('../models/Notification');
const {
  sendTextMessage,
  buildLowStockMessage,
  buildDailySalesMessage,
  buildWeeklyProfitMessage,
} = require('./whatsappService');

const TIMEZONE = 'Asia/Karachi';

const recordAndSend = async (shop, { type, title, message }) => {
  const target = shop.whatsappNumber || shop.phone;
  let deliveryStatus = 'sent';
  try {
    const result = await sendTextMessage(target, message);
    if (result?.skipped) deliveryStatus = 'skipped';
  } catch (err) {
    deliveryStatus = 'failed';
    console.error(`[scheduler] ${type} failed for shop ${shop._id}: ${err.message}`);
  }
  await Notification.create({
    shopId: shop._id,
    type,
    title,
    message,
    channel: 'whatsapp',
    deliveryStatus,
  });
};

// Iterates every active shop. Each shop's data stays isolated by shopId - the
// scheduler never aggregates across tenants.
const forEachActiveShop = async (handler) => {
  const shops = await Shop.find({ isActive: true });
  for (const shop of shops) {
    try {
      await handler(shop);
    } catch (err) {
      console.error(`[scheduler] shop ${shop._id} failed: ${err.message}`);
    }
  }
};

const runLowStockCheck = async () => {
  await forEachActiveShop(async (shop) => {
    const lowStock = await Product.find({
      shopId: shop._id,
      isActive: true,
      $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] },
    }).select('name stockQuantity unit');

    if (lowStock.length === 0) return;

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
    const shopId = new mongoose.Types.ObjectId(shop._id);

    const [salesAgg, expenseAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { shopId, status: 'completed', createdAt: { $gte: dayStart, $lte: dayEnd } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$items.subtotal' },
            cost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
            receipts: { $addToSet: '$_id' },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { shopId, date: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const revenue = salesAgg[0]?.revenue || 0;
    if (revenue === 0) return; // nothing sold today, don't spam the owner

    const cogs = salesAgg[0]?.cost || 0;
    const expenses = expenseAgg[0]?.total || 0;
    const grossProfit = revenue - cogs;

    await recordAndSend(shop, {
      type: 'daily_report',
      title: 'Daily sales report',
      message: buildDailySalesMessage(shop.name, {
        date: dayStart.toLocaleDateString('en-PK'),
        totalSales: revenue,
        transactions: salesAgg[0]?.receipts?.length || 0,
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
    const shopId = new mongoose.Types.ObjectId(shop._id);

    const [salesAgg, expenseAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { shopId, status: 'completed', createdAt: { $gte: from, $lte: to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$items.subtotal' },
            cost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { shopId, date: { $gte: from, $lte: to } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const revenue = salesAgg[0]?.revenue || 0;
    if (revenue === 0) return;

    const cogs = salesAgg[0]?.cost || 0;
    const expenses = expenseAgg[0]?.total || 0;
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
