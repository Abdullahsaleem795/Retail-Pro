import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  getProfitReport,
  getBestSellers,
  getDeadStock,
  getFastMoving,
  getLowMargin,
  getReorderSuggestions,
} from '../../api/reports';
import { formatCurrency, formatDate } from '../../utils/format';
import './Inventory.css';
import './DashboardHome.css';

const TABS = [
  { key: 'profit', label: 'Profit & Loss' },
  { key: 'best', label: 'Best Sellers' },
  { key: 'fast', label: 'Fast Moving' },
  { key: 'reorder', label: 'Reorder Suggestions' },
  { key: 'margin', label: 'Low Margin' },
  { key: 'dead', label: 'Dead Stock' },
];

export default function Reports() {
  const [tab, setTab] = useState('profit');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  // The always-on summary at the top of the Profit & Loss tab - fixed to the
  // last 30 days, loaded once alongside the other reports below.
  const [overallProfit, setOverallProfit] = useState(null);
  // The picker underneath it is separate and explicit: nothing is fetched
  // just from typing a date, only when "Show Report" is actually pressed -
  // so a half-picked date never flashes a stale/wrong result.
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [customProfit, setCustomProfit] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [overall, best, dead, fast, margin, reorder] = await Promise.all([
          getProfitReport({}),
          getBestSellers({ limit: 20, days: 30 }),
          getDeadStock({ days: 60 }),
          getFastMoving({ days: 30 }),
          getLowMargin({ threshold: 15 }),
          getReorderSuggestions({ days: 30, coverDays: 14 }),
        ]);
        setOverallProfit(overall.data);
        setData((prev) => ({
          ...prev,
          best: best.data,
          dead: dead.data,
          fast: fast.data,
          margin: margin.data,
          reorder: reorder.data,
          reorderTotal: reorder.totalEstimatedCost,
        }));
      } catch {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleShowReport = async () => {
    if (!customRange.from && !customRange.to) {
      toast.error('Pick a date first');
      return;
    }
    setCustomLoading(true);
    try {
      const res = await getProfitReport({
        from: customRange.from || undefined,
        to: customRange.to || undefined,
      });
      setCustomProfit(res.data);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setCustomLoading(false);
    }
  };

  if (loading) return <div className="page-loader">Loading reports...</div>;

  const profitStatCards = (profit) => (
    <div className="stat-grid">
      <div className="stat-card" style={{ borderTopColor: '#3b82f6' }}>
        <span className="stat-label">Revenue</span>
        <span className="stat-value">{formatCurrency(profit.revenue)}</span>
      </div>
      <div className="stat-card" style={{ borderTopColor: '#f59e0b' }}>
        <span className="stat-label">Cost of Goods Sold</span>
        <span className="stat-value">{formatCurrency(profit.cogs)}</span>
      </div>
      <div className="stat-card" style={{ borderTopColor: '#8b5cf6' }}>
        <span className="stat-label">Gross Profit</span>
        <span className="stat-value">{formatCurrency(profit.grossProfit)}</span>
      </div>
      <div className="stat-card" style={{ borderTopColor: '#ef4444' }}>
        <span className="stat-label">Expenses</span>
        <span className="stat-value">{formatCurrency(profit.expenses)}</span>
      </div>
      <div className="stat-card" style={{ borderTopColor: profit.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>
        <span className="stat-label">Net Profit</span>
        <span className="stat-value" style={{ color: profit.netProfit >= 0 ? '#16a34a' : '#dc2626' }}>
          {formatCurrency(profit.netProfit)}
        </span>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Reports</h1>

      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab-btn tab-btn-active' : 'tab-btn'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {tab === 'profit' && overallProfit && (
          <>
            <h2 className="report-section-title">Overall Report</h2>
            <p className="report-period">
              {formatDate(overallProfit.from)} — {formatDate(overallProfit.to)} (last 30 days)
            </p>
            {profitStatCards(overallProfit)}

            <h2 className="report-section-title report-section-title-spaced">View Report for a Day or Date Range</h2>
            <div className="filter-row">
              <div className="form-field">
                <label>From</label>
                <input
                  type="date"
                  value={customRange.from}
                  onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>To</label>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })}
                />
              </div>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setCustomRange({ from: today, to: today });
                }}
              >
                Today
              </button>
              <button type="button" className="btn-primary btn-inline" onClick={handleShowReport} disabled={customLoading}>
                {customLoading ? 'Loading...' : 'Show Report'}
              </button>
            </div>

            {customProfit && (
              <>
                <p className="report-period">
                  {formatDate(customProfit.from)} — {formatDate(customProfit.to)}
                </p>
                {profitStatCards(customProfit)}
              </>
            )}
          </>
        )}

        {tab === 'best' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Product</th><th>Units Sold</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {data.best?.length === 0 ? (
                  <tr><td colSpan={4} className="table-empty">Not enough sales data yet.</td></tr>
                ) : (
                  data.best?.map((b, i) => (
                    <tr key={b._id}>
                      <td>{i + 1}</td>
                      <td>{b.name}</td>
                      <td>{b.quantitySold}</td>
                      <td>{formatCurrency(b.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'fast' && (
          <>
            <p className="report-period">
              Your quickest-selling items. &quot;Days of cover&quot; is how long current stock lasts at the recent
              selling rate — anything under 7 days needs restocking before your next market trip.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Sold (30d)</th><th>Per Day</th><th>In Stock</th><th>Days of Cover</th></tr>
                </thead>
                <tbody>
                  {data.fast?.length === 0 ? (
                    <tr><td colSpan={5} className="table-empty">Not enough sales data yet.</td></tr>
                  ) : (
                    data.fast?.map((f) => (
                      <tr key={f._id}>
                        <td>{f.name}</td>
                        <td>{f.totalSold}</td>
                        <td>{f.dailyRate}</td>
                        <td>{f.stockQuantity} {f.unit}</td>
                        <td>
                          <span className={f.needsRestock ? 'badge badge-warning' : 'badge badge-ok'}>
                            {f.daysOfCover === null ? '—' : `${f.daysOfCover} days`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'reorder' && (
          <>
            <p className="report-period">
              Based on the last 30 days of sales, here is what to buy to cover the next 14 days.
              {data.reorderTotal > 0 && (
                <> Estimated total cost: <strong>{formatCurrency(data.reorderTotal)}</strong>.</>
              )}
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>In Stock</th><th>Per Day</th><th>Order Qty</th><th>Est. Cost</th><th>Supplier</th></tr>
                </thead>
                <tbody>
                  {data.reorder?.length === 0 ? (
                    <tr><td colSpan={6} className="table-empty">Stock levels look healthy. Nothing to reorder.</td></tr>
                  ) : (
                    data.reorder?.map((r) => (
                      <tr key={r._id}>
                        <td>{r.name}</td>
                        <td>{r.stockQuantity} {r.unit}</td>
                        <td>{r.dailyRate}</td>
                        <td><strong>{r.suggestedOrderQty} {r.unit}</strong></td>
                        <td>{formatCurrency(r.estimatedCost)}</td>
                        <td>{r.supplier?.name || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'margin' && (
          <>
            <p className="report-period">
              Products earning under 15% margin. After rent, electricity and transport, these may be costing you
              money to sell.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>Cost</th><th>Selling</th><th>Profit/Unit</th><th>Margin</th></tr>
                </thead>
                <tbody>
                  {data.margin?.length === 0 ? (
                    <tr><td colSpan={5} className="table-empty">All products are above 15% margin.</td></tr>
                  ) : (
                    data.margin?.map((m) => (
                      <tr key={m._id}>
                        <td>{m.name}</td>
                        <td>{formatCurrency(m.costPrice)}</td>
                        <td>{formatCurrency(m.sellingPrice)}</td>
                        <td style={{ color: m.isLoss ? '#dc2626' : undefined }}>{formatCurrency(m.profitPerUnit)}</td>
                        <td>
                          <span className={m.isLoss ? 'badge badge-danger' : 'badge badge-warning'}>
                            {m.marginPercent}%{m.isLoss ? ' (loss)' : ''}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'dead' && (
          <>
            <p className="report-period">
              Products with stock on hand but zero sales in the last 60 days — capital sitting idle on your shelves.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Tied-up Capital</th></tr>
                </thead>
                <tbody>
                  {data.dead?.length === 0 ? (
                    <tr><td colSpan={4} className="table-empty">No dead stock. Every product is moving.</td></tr>
                  ) : (
                    data.dead?.map((p) => (
                      <tr key={p._id}>
                        <td>{p.name}</td>
                        <td>{p.sku}</td>
                        <td>{p.stockQuantity}</td>
                        <td>{formatCurrency(p.stockQuantity * p.costPrice)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
