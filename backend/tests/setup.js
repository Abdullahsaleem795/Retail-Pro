/**
 * Spins up an in-memory MongoDB for the test run.
 *
 * A REPLICA SET is required, not a standalone: checkout and purchase-receiving
 * run inside transactions, and MongoDB only supports those on a replica set.
 * A standalone server would fail every money-path test with
 * "Transaction numbers are only allowed on a replica set member or mongos".
 */
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
}, 120000);

afterEach(async () => {
  // Wipe between tests so ordering never matters
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (replSet) await replSet.stop();
}, 60000);
