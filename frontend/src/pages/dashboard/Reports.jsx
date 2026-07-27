import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { getProfitReport, getBestSellers, getDeadStock } from '../../api/reports';
import { formatCurrency, formatDate } from '../../utils/format';
import './Inventory.css';
import './DashboardHome.css';

const TABS = [
  { key: 'profit', label: 'Profit & Loss' },
  { key: 'best', label: 'Best Sellers' },
  { key: 'dead', label: 'Dead Stock' },
];

export default function Reports() {
  const [tab, setTab] = useState('profit');
  const [profit, setProfit] = useState(null);
  const [bestSellers, setBestSellers] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profitRes, bestRes, deadRes] = await Promise.all([
          getProfitReport({}),
          getBestSellers({ limit: 20, days: 30 }),
          getDeadStock({ days: 60 }),
        ]);
        setProfit(profitRes.data);
        setBestSellers(bestRes.data);
        setDeadStock(deadRes.data);
      } catch {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="page-loader">Loading reports...</div>;

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
        {tab === 'profit' && profit && (
          <>
            <p className="report-period">
              {formatDate(profit.from)} — {formatDate(profit.to)} (last 30 days)
            </p>
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
          </>
        )}

        {tab === 'best' && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Product</th><th>Units Sold</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {bestSellers.length === 0 ? (
                  <tr><td colSpan={4} className="table-empty">Not enough sales data yet.</td></tr>
                ) : (
                  bestSellers.map((b, i) => (
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
                  {deadStock.length === 0 ? (
                    <tr><td colSpan={4} className="table-empty">No dead stock. Every product is moving.</td></tr>
                  ) : (
                    deadStock.map((p) => (
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
