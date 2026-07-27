/**
 * Connectivity smoke test:  node src/utils/testConnection.js
 *
 * Verifies the Atlas URI works, confirms the deployment is a replica set
 * (required for the transactions used by checkout and purchase-receiving),
 * and lists existing collections.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('REPLACE_ME')) {
    console.error('MONGODB_URI still contains the REPLACE_ME placeholder.');
    console.error('Set your Atlas database username in backend/.env first.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

  const admin = mongoose.connection.db.admin();
  const info = await admin.command({ hello: 1 });

  console.log(`\nConnected to: ${mongoose.connection.host}`);
  console.log(`Database:     ${mongoose.connection.name}`);
  console.log(`Topology:     ${info.setName ? `replica set "${info.setName}"` : 'standalone'}`);

  if (info.setName) {
    console.log('Transactions: supported (checkout and purchase-receiving will work)');
  } else {
    console.log('Transactions: NOT supported - standalone server. Sales checkout will fail.');
  }

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(
    `\nCollections (${collections.length}): ${collections.map((c) => c.name).join(', ') || '(empty database)'}`
  );

  await mongoose.connection.close();
  console.log('\nConnection test passed.');
  process.exit(0);
};

run().catch(async (err) => {
  console.error(`\nConnection failed: ${err.message}`);
  if (/authentication failed/i.test(err.message)) {
    console.error('-> Check the username and password in backend/.env (Atlas > Database Access).');
  }
  if (/ETIMEDOUT|ENOTFOUND|serverSelectionTimeout/i.test(err.message)) {
    console.error('-> Check Atlas > Network Access allows your current IP address.');
  }
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
