require('dotenv').config();
const { connectDB } = require('./src/config/db');
const app = require('./src/app');
const { startScheduler } = require('./src/services/scheduler');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`RetailPro API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  // Opt-out via DISABLE_SCHEDULER=true so multi-instance deployments can run the
  // cron jobs on a single worker instead of every replica.
  if (process.env.DISABLE_SCHEDULER !== 'true') {
    startScheduler();
  }
});

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
});
