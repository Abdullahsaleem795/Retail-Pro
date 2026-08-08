import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { listSales, getSalesSummary, refundSale, downloadReceipt } from '../../api/sales';
import { useAuth } from '../../context/useAuth';
import { formatCurrency, formatDateTime, formatPaymentMethod, capitalize } from '../../utils/format';
import ThermalPrintButton from '../../components/ThermalPrintButton';
import ConfirmModal from '../../components/ConfirmModal';
import StatCard from '../../components/StatCard';
import PaymentBadge from '../../components/PaymentBadge';
import './Inventory.css';
import './DashboardHome.css';
import './Sales.css';

export default function Sales() {
  const { user, shop } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refunding, setRefunding] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());

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
      // A previous selection could point at rows no longer in view (new
      // filter, refund removed a row from a status the owner cares about).
      setCheckedIds(new Set());
    } catch {
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getSalesSummary();
      setSummary(res.data);
    } catch {
      // Stat cards just stay blank/zero - not worth blocking the page over.
    }
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleRefundConfirm = async () => {
    if (!refunding) return;
    try {
      await refundSale(refunding._id);
      toast.success('Sale refunded');
      setSelected(null);
      setRefunding(null);
      fetchSales();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    }
  };

  const toggleChecked = (id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCheckedAll = () => {
    setCheckedIds((prev) => (prev.size === sales.length ? new Set() : new Set(sales.map((s) => s._id))));
  };

  // CSV of whatever's checked, or the whole currently-filtered list if
  // nothing's checked - a real export of what's actually loaded, not a fake
  // "coming soon" button.
  const handleExport = () => {
    setExporting(true);
    try {
      const rows = checkedIds.size > 0 ? sales.filter((s) => checkedIds.has(s._id)) : sales;
      if (rows.length === 0) {
        toast.error('No sales to export');
        return;
      }
      const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const header = ['Receipt', 'Date', 'Customer', 'Items', 'Payment Method', 'Total', 'Status'];
      const lines = [header.map(escapeCsv).join(',')];
      rows.forEach((s) => {
        lines.push(
          [
            s.receiptNumber,
            formatDateTime(s.createdAt),
            s.customerId?.name || 'Walk-in',
            s.items.length,
            formatPaymentMethod(s.paymentMethod),
            s.totalAmount,
            capitalize(s.status),
          ]
            .map(escapeCsv)
            .join(',')
        );
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
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
      <div className="page-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Sales History</h1>
        <div className="page-header-actions">
          <button className="btn-secondary btn-inline" onClick={handleExport} disabled={exporting || sales.length === 0}>
            {exporting ? 'Exporting...' : `Export${checkedIds.size > 0 ? ` (${checkedIds.size})` : ''}`}
          </button>
          <Link to="/dashboard/pos" className="btn-primary btn-inline">
            + New Sale
          </Link>
        </div>
      </div>

      <div className="stat-grid sales-stat-grid">
        <StatCard label="Total Sales" value={summary?.totalThisMonth ?? '—'} period="This month" gradient />
        <StatCard label="New Sales" value={summary?.newToday ?? '—'} period="Today" />
        <StatCard label="Completed" value={summary?.completedThisMonth ?? '—'} period="This month" />
        <StatCard label="Refunded" value={summary?.refundedThisMonth ?? '—'} period="This month" />
      </div>

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
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={sales.length > 0 && checkedIds.size === sales.length}
                  onChange={toggleCheckedAll}
                  aria-label="Select all sales"
                />
              </th>
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
              <tr><td colSpan={9} className="table-empty">Loading...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">No sales recorded yet.</td></tr>
            ) : (
              sales.map((s) => (
                <tr key={s._id}>
                  <td className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(s._id)}
                      onChange={() => toggleChecked(s._id)}
                      aria-label={`Select sale ${s.receiptNumber}`}
                    />
                  </td>
                  <td>{s.receiptNumber}</td>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td className="truncate" title={s.customerId?.name}>{s.customerId?.name || 'Walk-in'}</td>
                  <td>{s.items.length}</td>
                  <td><PaymentBadge method={s.paymentMethod} /></td>
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
