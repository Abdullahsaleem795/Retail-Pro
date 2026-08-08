// JazzCash Mobile Wallet / Merchant Checkout integration scaffold - NOT live.
//
// To go live, the user needs a real JazzCash merchant account (apply at
// https://www.jazzcash.com.pk/business/), which provides:
//   - Merchant ID
//   - Password
//   - Integrity Salt (used to HMAC-sign each request per JazzCash's docs)
// Their sandbox/live API details and the exact request/response field names
// (pp_*, transaction hashing rules, etc.) come from the merchant onboarding
// packet JazzCash sends - not reproduced here since this project has never
// had real credentials to verify field names/behavior against.
const isConfigured = () =>
  Boolean(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT);

const createPaymentRequest = async () => {
  throw new Error(
    'JazzCash merchant API is not configured (JAZZCASH_MERCHANT_ID / JAZZCASH_PASSWORD / JAZZCASH_INTEGRITY_SALT unset). ' +
    'Falls back to the manual provider until real merchant credentials are added here.'
  );
};

module.exports = { isConfigured, createPaymentRequest };
