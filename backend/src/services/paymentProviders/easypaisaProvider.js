// EasyPaisa Merchant API integration scaffold - NOT live.
//
// To go live, the user needs a real Easypaisa merchant account (apply via
// Telenor Microfinance Bank business channels), which provides a Store ID
// and Hash Key for their Open API / Easypaisa Payment Gateway. The exact
// request/response contract comes from that onboarding packet - not
// reproduced here since this project has never had real credentials to
// verify field names/behavior against.
const isConfigured = () => Boolean(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);

const createPaymentRequest = async () => {
  throw new Error(
    'EasyPaisa merchant API is not configured (EASYPAISA_STORE_ID / EASYPAISA_HASH_KEY unset). ' +
    'Falls back to the manual provider until real merchant credentials are added here.'
  );
};

module.exports = { isConfigured, createPaymentRequest };
