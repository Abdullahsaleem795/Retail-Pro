// Test-only secrets. Real secrets come from .env at runtime; these exist so the
// suite never depends on a developer's local environment being configured.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-used-in-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-in-production';
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';
process.env.DISABLE_SCHEDULER = 'true';
process.env.CLIENT_URL = 'http://localhost:5173';
