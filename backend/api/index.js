const app = require('../src/app');

// We don't call app.listen() here because Vercel Serverless handles the routing and binding automatically.
// The PostgreSQL pool in db.js handles connections automatically on query execution.

module.exports = app;
