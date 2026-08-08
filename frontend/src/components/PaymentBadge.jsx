import { formatPaymentMethod } from '../utils/format';
import './PaymentBadge.css';

// Brand-ish colors for the payment methods this app actually supports (not
// literal card-network logos - JazzCash/EasyPaisa don't have a safe-to-embed
// logo asset here, so a colored dot + label reads clearly without it).
const PAYMENT_COLORS = {
  cash: '#16a34a',
  card: '#3b82f6',
  credit: '#f59e0b',
  jazzcash: '#dc2626',
  easypaisa: '#0d9488',
};

export default function PaymentBadge({ method }) {
  const color = PAYMENT_COLORS[method] || '#64748b';
  return (
    <span className="payment-badge" style={{ '--payment-color': color }}>
      <span className="payment-badge-dot" />
      {formatPaymentMethod(method)}
    </span>
  );
}
