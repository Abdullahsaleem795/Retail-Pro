// Always "configured" - this is the guaranteed fallback so subscription
// requests never fail even when no real gateway is wired up.
const isConfigured = () => true;

// Records intent only; no money moves through this app. The shop owner pays
// externally (bank transfer, JazzCash/EasyPaisa personal transfer, cash) and
// pastes a transaction ID as proof, verified manually by the platform admin
// via /api/admin/shops/:shopId/subscription/activate.
const createPaymentRequest = async ({ transactionId, notes }) => ({
  status: 'manual_review_required',
  reference: transactionId || null,
  notes: notes || null,
});

module.exports = { isConfigured, createPaymentRequest };
