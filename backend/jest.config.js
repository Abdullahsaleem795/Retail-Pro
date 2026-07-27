module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // The in-memory replica set is shared process-wide; running suites in
  // parallel would let them wipe each other's collections between tests.
  maxWorkers: 1,
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/utils/seed.js', '!src/utils/testConnection.js'],
};
