import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getExpiryAlerts } from '../../api/products';
import { formatDate } from '../../utils/format';
import './ExpiryAlerts.css';

const daysRemainingLabel = (days) => {
  if (days < 0) return `Expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Expires today';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
};

const daysRemainingBadgeClass = (days) => (days <= 0 ? 'badge badge-danger' : 'badge badge-warning');

export default function ExpiryAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExpiryAlerts()
      .then((res) => setAlerts(res.data))
      .catch(() => toast.error('Failed to load expiry alerts'))
      .finally(() => setLoading(false));
  }, []);

  // Grouped by the alert threshold the owner set per product (e.g. every
  // product with a "5 days before" alert lands in the same 5-day section),
  // not by however many days each one actually has left - a product stays
  // in its section (including past expiry) until it's restocked with a new
  // date or the alert is turned off.
  const sections = useMemo(() => {
    const byThreshold = new Map();
    alerts.forEach((a) => {
      const key = a.expiryAlertDays;
      if (!byThreshold.has(key)) byThreshold.set(key, []);
      byThreshold.get(key).push(a);
    });
    return [...byThreshold.entries()]
      .sort(([a], [b]) => a - b)
      .map(([days, items]) => [days, items.sort((a, b) => a.daysRemaining - b.daysRemaining)]);
  }, [alerts]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Expiry Date Alerts</h1>
      </div>

      {loading ? (
        <p className="table-empty">Loading...</p>
      ) : alerts.length === 0 ? (
        <p className="table-empty">
          No expiry alerts right now. Set an "Expiry Alert" when adding or editing a product in
          Inventory to have it show up here once it's within that many days of its expiry date.
        </p>
      ) : (
        sections.map(([days, items]) => (
          <div key={days} className="expiry-section">
            <h2 className="expiry-section-title">
              {days}-Day Alert
              <span className="expiry-section-count">{items.length}</span>
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id}>
                      <td className="truncate" title={p.name}>{p.name}</td>
                      <td>{p.sku}</td>
                      <td>{p.stockQuantity} {p.unit}</td>
                      <td>{formatDate(p.expiryDate)}</td>
                      <td>
                        <span className={daysRemainingBadgeClass(p.daysRemaining)}>
                          {daysRemainingLabel(p.daysRemaining)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
