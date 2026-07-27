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
