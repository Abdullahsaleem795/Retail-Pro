// Gates the platform-operator endpoints (cross-tenant: activating any shop's
// subscription, viewing all shops). This is deliberately NOT the same as
// requirePermission('shop:settings') - that permission is scoped to a shop
// owner acting on their OWN shop. Subscription activation must be gated by
// something the shop owner does not control at all, or a shop could always
// self-activate a paid plan without paying (see knowledge-graph.md gap #2).
//
// Fails closed: if PLATFORM_ADMIN_KEY is unset, every request is rejected
// rather than silently allowed.
const requirePlatformAdmin = (req, res, next) => {
  const configuredKey = process.env.PLATFORM_ADMIN_KEY;

  if (!configuredKey) {
    res.status(503);
    throw new Error('Platform admin console is not configured (PLATFORM_ADMIN_KEY unset)');
  }

  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== configuredKey) {
    res.status(401);
    throw new Error('Invalid or missing admin key');
  }

  next();
};

module.exports = { requirePlatformAdmin };
