module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  setupFiles: ['<rootDir>/tests/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // The retailpro_test schema is shared process-wide across test files;
  // running suites in parallel would let them truncate each other's rows
  // mid-test.
  maxWorkers: 1,
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/utils/seed.js', '!src/utils/testConnection.js'],
};
