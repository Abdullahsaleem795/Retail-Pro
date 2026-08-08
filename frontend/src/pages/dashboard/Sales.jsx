import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { listSales, refundSale, downloadReceipt } from '../../api/sales';
import { useAuth } from '../../context/useAuth';
import { formatCurrency, formatDateTime, formatPaymentMethod, capitalize } from '../../utils/format';
import ThermalPrintButton from '../../components/ThermalPrintButton';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

export default function Sales() {
  const { user, shop } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [downloading, setDownloading] = useState(false);
  const [refunding, setRefunding] = useState(null);

  const canRefund = user?.role === 'owner' || user?.role === 'manager';

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSales({
        from: range.from || undefined,
        to: range.to || undefined,
        limit: 50,
      });
      setSales(res.data);
    } catch {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleRefundConfirm = async () => {
    if (!refunding) return;
    try {
      await refundSale(refunding._id);
      toast.success('Sale refunded');
      setSelected(null);
      setRefunding(null);
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    }
  };

  // The receipt endpoint is JWT-protected, so a plain <a href> would 401.
  // Fetch it as a blob through the authed client and hand it to the browser.
  const handleDownloadReceipt = async (sale) => {
    setDownloading(true);
    try {
      const blob = await downloadReceipt(sale._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sale.receiptNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate receipt');
    } finally {
      setDownloading(false);
    }
  };

  const statusBadge = (status) => {
    const map = { completed: 'badge-ok', refunded: 'badge-warning', voided: 'badge-warning' };
    return <span className={`badge ${map[status] || 'badge-ok'}`}>{capitalize(status)}</span>;
  };

  return (
    <div>
      <h1 className="page-title">Sales History</h1>

      <div className="filter-row">
        <div className="form-field">
          <label>From</label>
          <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </div>
        <div className="form-field">
          <label>To</label>
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </div>
        {(range.from || range.to) && (
          <button className="btn-link" onClick={() => setRange({ from: '', to: '' })}>
            Clear
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Loading...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No sales recorded yet.</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s._id}>
                  <td>{s.receiptNumber}</td>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td className="truncate" title={s.customerId?.name}>{s.customerId?.name || 'Walk-in'}</td>
                  <td>{s.items.length}</td>
                  <td>{formatPaymentMethod(s.paymentMethod)}</td>
                  <td>{formatCurrency(s.totalAmount)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td className="table-actions">
                    <button className="btn-link" onClick={() => setSelected(s)}>View</button>
                    {canRefund && s.status === 'completed' && (
                      <button className="btn-link btn-link-danger" onClick={() => setRefunding(s)}>
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <motion.div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <div className="modal-title">Receipt {selected.receiptNumber}</div>
            <div className="receipt-meta">
              <span>{formatDateTime(selected.createdAt)}</span>
              <span>{selected.customerId?.name || 'Walk-in customer'}</span>
            </div>

            <table className="data-table" style={{ marginTop: '1rem' }}>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {selected.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pos-totals" style={{ marginTop: '1rem' }}>
              <div><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
              <div><span>Discount</span><span>- {formatCurrency(selected.discount)}</span></div>
              <div><span>Tax</span><span>{formatCurrency(selected.tax)}</span></div>
              <div className="pos-total-grand"><span>Total</span><span>{formatCurrency(selected.totalAmount)}</span></div>
            </div>

            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
              {canRefund && selected.status === 'completed' && (
                <button className="btn-danger" onClick={() => setRefunding(selected)}>
                  Refund
                </button>
              )}
              <ThermalPrintButton sale={selected} shop={shop} />
              <button
                className="btn-primary"
                style={{ flex: 1, marginTop: 0 }}
                onClick={() => handleDownloadReceipt(selected)}
                disabled={downloading}
              >
                {downloading ? 'Preparing...' : 'Download PDF'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {refunding && (
        <ConfirmModal
          title="Refund sale"
          message={`Refund receipt ${refunding.receiptNumber}? Stock will be returned to inventory.`}
          confirmText="Refund Sale"
          onConfirm={handleRefundConfirm}
          onClose={() => setRefunding(null)}
        />
      )}
    </div>
  );
}
