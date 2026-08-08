// Single source of truth for human-readable permission names. Previously
// duplicated separately in Staff.jsx and Profile.jsx, which had already
// drifted out of sync - adding branch:manage (see backend
// config/permissions.js) only updated one of the two copies, so Profile.jsx
// showed the raw permission key instead of a label until this fix.
export const PERMISSION_LABELS = {
  'product:manage': 'Manage products',
  'category:manage': 'Manage categories',
  'supplier:manage': 'Manage suppliers',
  'purchase:manage': 'Manage purchases',
  'expense:manage': 'Record expenses',
  'sale:refund': 'Refund sales',
  'report:view': 'View reports',
  'staff:manage': 'Manage staff',
  'shop:settings': 'Change shop settings',
  'notification:send': 'Send WhatsApp alerts',
  'branch:manage': 'Manage branches & transfers',
};
