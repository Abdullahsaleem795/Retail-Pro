/**
 * Permission model.
 *
 * Roles give a sensible default set. The `permissions` array on a user is an
 * ADDITIVE override on top of that, so an owner can hand one trusted cashier
 * the ability to (say) record expenses without promoting them to manager.
 *
 * Additive-only is deliberate: a subtractive model means an owner can lock
 * themselves out of their own shop, and support can't fix it for them.
 */

const PERMISSIONS = {
  PRODUCT_MANAGE: 'product:manage',
  CATEGORY_MANAGE: 'category:manage',
  SUPPLIER_MANAGE: 'supplier:manage',
  PURCHASE_MANAGE: 'purchase:manage',
  EXPENSE_MANAGE: 'expense:manage',
  SALE_REFUND: 'sale:refund',
  REPORT_VIEW: 'report:view',
  STAFF_MANAGE: 'staff:manage',
  SHOP_SETTINGS: 'shop:settings',
  NOTIFICATION_SEND: 'notification:send',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Cashiers can sell and look things up; everything that changes money or
// inventory records defaults to manager and above.
const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  manager: [
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.SUPPLIER_MANAGE,
    PERMISSIONS.PURCHASE_MANAGE,
    PERMISSIONS.EXPENSE_MANAGE,
    PERMISSIONS.SALE_REFUND,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.NOTIFICATION_SEND,
  ],
  cashier: [],
};

// Permissions an owner is allowed to grant to staff. STAFF_MANAGE and
// SHOP_SETTINGS are withheld so a granted permission can never be used to
// escalate into full control of the shop.
const GRANTABLE_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => p !== PERMISSIONS.STAFF_MANAGE && p !== PERMISSIONS.SHOP_SETTINGS
);

const getEffectivePermissions = (user) => {
  const base = ROLE_PERMISSIONS[user.role] || [];
  const granted = (user.permissions || []).filter((p) => GRANTABLE_PERMISSIONS.includes(p));
  return [...new Set([...base, ...granted])];
};

const userHasPermission = (user, permission) => getEffectivePermissions(user).includes(permission);

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  getEffectivePermissions,
  userHasPermission,
};
