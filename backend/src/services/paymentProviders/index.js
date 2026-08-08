// Pluggable payment-provider seam for subscription billing. This does NOT
// claim to be a live JazzCash/EasyPaisa integration - neither provider's
// merchant API can be called without real merchant credentials (merchant ID,
// password, integrity salt / store ID + hash key), which this project does
// not have. What's here is the correct shape to plug those into once the
// user has a real merchant account, so requestSubscriptionUpgrade doesn't
// need to change when that happens - only the provider's isConfigured()
// needs to start returning true.
//
// Until then, every provider falls back to `manualProvider`: record the
// claimed transaction ID, notify the shop, and ping the platform admin on
// WhatsApp for manual verification - the actual flow in production today.
const manualProvider = require('./manualProvider');
const jazzcashProvider = require('./jazzcashProvider');
const easypaisaProvider = require('./easypaisaProvider');

const PROVIDERS = {
  jazzcash: jazzcashProvider,
  easypaisa: easypaisaProvider,
};

// Resolves the best available provider for a payment channel. Falls back to
// manual whenever the "real" provider isn't configured (which is always,
// today) so callers never have to branch on configuration state themselves.
const getProvider = (channel) => {
  const key = (channel || '').toLowerCase();
  const candidate = PROVIDERS[key];
  if (candidate && candidate.isConfigured()) return candidate;
  return manualProvider;
};

module.exports = { getProvider, manualProvider, jazzcashProvider, easypaisaProvider };
