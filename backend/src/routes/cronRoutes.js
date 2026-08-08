// HTTP-triggerable versions of scheduler.js's three jobs, for Vercel Cron
// Jobs (see /backend/vercel.json "crons"). node-cron (scheduler.js,
// startScheduler()) needs a long-running process and never fires under
// Vercel serverless - backend/api/index.js never calls it. These routes are
// the actual fix: Vercel's own cron infrastructure hits these on a schedule
// instead. Kept as separate endpoints (not one) so each can be retried/
// monitored independently in the Vercel dashboard.
const express = require('express');
const asyncHandler = require('express-async-handler');
const { runLowStockCheck, runDailySalesReport, runWeeklyProfitReport } = require('../services/scheduler');

const router = express.Router();

// Vercel signs its own cron requests with `Authorization: Bearer $CRON_SECRET`
// when CRON_SECRET is set as a project env var - verified here so this
// endpoint can't be hit by anyone who finds the URL. Fails closed if unset.
const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503);
    throw new Error('Cron endpoints not configured (CRON_SECRET unset)');
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401);
    throw new Error('Invalid cron secret');
  }
  next();
};

router.use(requireCronSecret);

router.get('/low-stock', asyncHandler(async (req, res) => {
  await runLowStockCheck();
  res.json({ success: true, job: 'low-stock', ranAt: new Date() });
}));

router.get('/daily-report', asyncHandler(async (req, res) => {
  await runDailySalesReport();
  res.json({ success: true, job: 'daily-report', ranAt: new Date() });
}));

router.get('/weekly-report', asyncHandler(async (req, res) => {
  await runWeeklyProfitReport();
  res.json({ success: true, job: 'weekly-report', ranAt: new Date() });
}));

module.exports = router;
