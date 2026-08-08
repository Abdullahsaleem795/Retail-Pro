// Pakistani rupee formatting, used across dashboard, POS, and reports so
// currency rendering stays consistent everywhere.
export const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  return `Rs ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
};

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Raw enum values (payment methods, sale/purchase statuses) are stored
// lowercase for the DB/API, but showing them lowercase in the UI (e.g. a
// bare "cash" or "completed" sitting next to properly-cased column headers)
// reads as unfinished. Every place that displays one of these should go
// through here instead of interpolating the raw value directly.
export const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  credit: 'Credit',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
};

export const formatPaymentMethod = (method) => PAYMENT_METHOD_LABELS[method] || capitalize(method);
