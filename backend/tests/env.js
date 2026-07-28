// Test-only secrets. Real secrets come from .env at runtime; these exist so the
// suite never depends on a developer's local environment being configured.
require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-used-in-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-used-in-production';
process.env.JWT_ACCESS_EXPIRES = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';
process.env.DISABLE_SCHEDULER = 'true';
process.env.CLIENT_URL = 'http://localhost:5173';

// DATABASE_URL itself comes from the real .env (Supabase pooler connection
// string) - only the schema is overridden, so the suite runs against an
// isolated `retailpro_test` schema on the same project and never touches
// real shop data in `retailpro`.
process.env.DB_SCHEMA = 'retailpro_test';
