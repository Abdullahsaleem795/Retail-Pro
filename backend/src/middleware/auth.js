const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const { query } = require('../config/db');
const { mapRow } = require('../utils/sqlMapper');
const { getEffectivePermissions, userHasPermission } = require('../config/permissions');

// Verifies the access token and injects { userId, shopId, role } into req.
// Every downstream controller must scope its queries by req.shopId - never trust
// a shopId coming from the request body/params, only from this verified token.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }

  const { rows } = await query(
    'SELECT id, shop_id, name, email, phone, role, permissions, is_active FROM users WHERE id = $1',
    [decoded.userId]
  );
  const user = mapRow(rows[0]);

  if (!user || !user.isActive) {
    res.status(401);
    throw new Error('Not authorized, user not found or deactivated');
  }

  req.userId = user._id;
  req.shopId = user.shopId;
  req.role = user.role;
  req.user = user;
  req.permissions = getEffectivePermissions(user);

  next();
});

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.role)) {
    res.status(403);
    throw new Error(`Role '${req.role}' is not permitted to perform this action`);
  }
  next();
};

// Prefer this over requireRole for capability checks: it honours per-user
// grants, so an owner can extend one cashier without changing their role.
const requirePermission = (permission) => (req, res, next) => {
  if (!userHasPermission(req.user, permission)) {
    res.status(403);
    throw new Error(`You do not have permission to perform this action (${permission})`);
  }
  next();
};

module.exports = { protect, requireRole, requirePermission };
