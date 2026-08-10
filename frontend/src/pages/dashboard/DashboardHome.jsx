import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { FiTrendingUp, FiShoppingCart, FiDollarSign, FiAlertTriangle, FiUsers, FiPackage } from 'react-icons/fi';
import { getDashboardOverview } from '../../api/reports';
import { useAuth } from '../../context/useAuth';
import { formatCurrency, formatDateTime, capitalize } from '../../utils/format';
import SkeletonLoader from '../../components/SkeletonLoader';
import TrendStatCard from '../../components/TrendStatCard';
import './Inventory.css';
import './DashboardHome.css';

// Builds a chronological, zero-filled 14-day array from the trend rows the
// API returns (which only include days that actually had a sale) - the chart
// needs a value for EVERY day, not just the ones with data, otherwise
// Recharts' categorical x-axis spaces sparse real days evenly regardless of
// the actual gap between them, drawing a misleading line across a quiet
// stretch instead of showing it as quiet.
const zeroFill14Days = (rawTrend) => {
  const byDate = new Map(rawTrend.map((d) => [d._id, d]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    const match = byDate.get(key);
    days.push({
      _id: key,
      date: new Date(key).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }),
      total: match?.total ?? 0,
      transactions: match?.transactions ?? 0,
    });
  }
  return days;
};

// "32000" -> "32k" - matches the compact-number style real dashboards use on
// a Y-axis; the exact figure is still available in the tooltip on hover.
const compactNumber = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

// Returns null (no badge shown) rather than a fabricated/meaningless
// percentage when last week was 0 - "up from nothing" isn't a real percent.
const computeTrend = (current, previous) => {
  if (!previous) return null;
  const percent = ((current - previous) / previous) * 100;
  return { direction: percent >= 0 ? 'up' : 'down', percent };
};

const thisWeekRangeLabel = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const fmt = (d) => d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
};

const STOCK_COLORS = { inStock: '#16a34a', lowStock: '#f59e0b', outOfStock: '#dc2626' };

const STATUS_BADGE = { completed: 'badge-ok', refunded: 'badge-warning', voided: 'badge-danger' };

export default function DashboardHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [weekComparison, setWeekComparison] = useState(null);
  const [stockBreakdown, setStockBreakdown] = useState(null);
  const [trend, setTrend] = useState([]);
  const [hasSalesHistory, setHasSalesHistory] = useState(false);
  const [bestSellers, setBestSellers] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getDashboardOverview();
        const { summary: s, trend: t, bestSellers: b, weekComparison: wk, stockBreakdown: sb, recentSales: rs } = res.data;
        const rawTrend = t || [];
        setSummary(s);
        setWeekComparison(wk);
        setStockBreakdown(sb);
        setTrend(zeroFill14Days(rawTrend));
        setHasSalesHistory(rawTrend.length > 0);
        setBestSellers(b || []);
        setRecentSales(rs || []);
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <SkeletonLoader type="card" count={5} />
      </div>
    );
  }

  const thisWeek = weekComparison?.thisWeek || { sales: 0, orders: 0, profit: 0, itemsSold: 0, newCustomers: 0 };
  const lastWeek = weekComparison?.lastWeek || { sales: 0, orders: 0, profit: 0, newCustomers: 0 };
  const avgOrderValue = thisWeek.orders > 0 ? thisWeek.sales / thisWeek.orders : 0;
  // A rough but reasonable proxy: total customers minus the ones created in
  // the last 7 days = roughly how many existed a week ago (assumes no
  // customer records were deleted in that window, which is the common case).
  const lastWeekTotalCustomers = Math.max((summary?.totalCustomers || 0) - thisWeek.newCustomers, 0);

  const stockTotal = stockBreakdown ? stockBreakdown.inStock + stockBreakdown.lowStock + stockBreakdown.outOfStock : 0;
  const stockPieData = stockBreakdown
    ? [
        { key: 'inStock', name: 'In Stock', value: stockBreakdown.inStock },
        { key: 'lowStock', name: 'Low Stock', value: stockBreakdown.lowStock },
        { key: 'outOfStock', name: 'Out of Stock', value: stockBreakdown.outOfStock },
      ]
    : [];

  const cards = [
    {
      key: 'sales',
      icon: FiTrendingUp,
      iconColor: '#2563eb',
      label: 'Total Sales',
      value: formatCurrency(thisWeek.sales),
      trend: computeTrend(thisWeek.sales, lastWeek.sales),
      comparisonLabel: `vs last week ${formatCurrency(lastWeek.sales)}`,
    },
    {
      key: 'orders',
      icon: FiShoppingCart,
      iconColor: '#16a34a',
      label: 'Total Orders',
      value: thisWeek.orders,
      trend: computeTrend(thisWeek.orders, lastWeek.orders),
      comparisonLabel: `vs last week ${lastWeek.orders}`,
    },
    {
      key: 'profit',
      icon: FiDollarSign,
      iconColor: '#7c3aed',
      label: 'Total Profit',
      value: formatCurrency(thisWeek.profit),
      trend: computeTrend(thisWeek.profit, lastWeek.profit),
      comparisonLabel: `vs last week ${formatCurrency(lastWeek.profit)}`,
    },
    {
      key: 'lowStock',
      icon: FiAlertTriangle,
      iconColor: '#f59e0b',
      label: 'Low Stock Items',
      value: summary?.lowStockItems ?? 0,
      warning: (summary?.lowStockItems ?? 0) > 0 ? 'Need attention' : 'All good',
      to: '/dashboard/low-stock',
    },
    {
      key: 'customers',
      icon: FiUsers,
      iconColor: '#0d9488',
      label: 'Total Customers',
      value: summary?.totalCustomers ?? 0,
      trend: computeTrend(summary?.totalCustomers ?? 0, lastWeekTotalCustomers),
      comparisonLabel: `vs last week ${lastWeekTotalCustomers}`,
      to: '/dashboard/customers',
    },
  ];

  return (
    <div>
      <div className="dash-welcome-row">
        <div>
          <h1 className="page-title dash-welcome-title">Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋</h1>
          <p className="dash-welcome-sub">Here&apos;s what&apos;s happening with your store today.</p>
        </div>
        <span className="dash-date-range">{thisWeekRangeLabel()}</span>
      </div>

      <div className="trend-stat-grid">
        {cards.map((c, i) => {
          // eslint-disable-next-line no-unused-vars
          const { key, ...cardProps } = c;
          const card = <TrendStatCard {...cardProps} />;
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              {c.to ? <Link to={c.to} className="trend-stat-card-link">{card}</Link> : card}
            </motion.div>
          );
        })}
      </div>

      <div className="dash-main-grid">
        <div className="dash-main-col">
          <div className="chart-card">
            <div className="dash-panel-header">
              <h2 className="chart-title">Sales Overview</h2>
              <span className="dash-panel-tag">Last 14 Days</span>
            </div>
            {!hasSalesHistory ? (
              <p className="empty-hint">No sales recorded yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                    <XAxis
                      dataKey="date"
                      interval={1}
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      padding={{ left: 8, right: 8 }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={compactNumber}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{ borderRadius: 10, border: '1px solid #eef2f6', boxShadow: '0 4px 12px rgba(16,24,40,0.08)' }}
                      labelStyle={{ color: '#475569', fontWeight: 600 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="url(#salesFill)"
                      dot={{ r: 3, strokeWidth: 2, stroke: '#2563eb', fill: '#fff' }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="dash-metric-strip">
                  <div>
                    <span className="dash-metric-label">Total Sales</span>
                    <span className="dash-metric-value" style={{ color: '#2563eb' }}>{formatCurrency(thisWeek.sales)}</span>
                  </div>
                  <div>
                    <span className="dash-metric-label">Total Profit</span>
                    <span className="dash-metric-value" style={{ color: '#16a34a' }}>{formatCurrency(thisWeek.profit)}</span>
                  </div>
                  <div>
                    <span className="dash-metric-label">Avg. Order Value</span>
                    <span className="dash-metric-value" style={{ color: '#7c3aed' }}>{formatCurrency(avgOrderValue)}</span>
                  </div>
                  <div>
                    <span className="dash-metric-label">Items Sold</span>
                    <span className="dash-metric-value" style={{ color: '#d97706' }}>{thisWeek.itemsSold}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="chart-card">
            <div className="dash-panel-header">
              <h2 className="chart-title">Recent Orders</h2>
              <Link to="/dashboard/sales" className="dash-panel-link">View All</Link>
            </div>
            {recentSales.length === 0 ? (
              <p className="empty-hint">No sales recorded yet.</p>
            ) : (
              <div className="table-wrap dash-recent-orders-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s._id} className="dash-recent-order-row" onClick={() => (window.location.href = '/dashboard/sales')}>
                        <td>{s.receiptNumber}</td>
                        <td className="truncate" title={s.customerId?.name}>{s.customerId?.name || 'Walk-in'}</td>
                        <td>{formatDateTime(s.createdAt)}</td>
                        <td>{formatCurrency(s.totalAmount)}</td>
                        <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-ok'}`}>{capitalize(s.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="dash-main-col dash-main-col-side">
          <div className="chart-card">
            <div className="dash-panel-header">
              <h2 className="chart-title">Top Selling Products</h2>
              <Link to="/dashboard/reports" className="dash-panel-link">View All</Link>
            </div>
            {bestSellers.length === 0 ? (
              <p className="empty-hint">Not enough sales data yet.</p>
            ) : (
              <div className="dash-top-products">
                {bestSellers.map((p, i) => (
                  <div className="dash-top-product-row" key={p._id}>
                    <span className="dash-top-product-rank">{i + 1}</span>
                    <span className="dash-top-product-icon"><FiPackage size={16} /></span>
                    <div className="dash-top-product-info">
                      <span className="dash-top-product-name">{p.name}</span>
                      <span className="dash-top-product-sku">{p.sku || '—'}</span>
                    </div>
                    <div className="dash-top-product-stats">
                      <span className="dash-top-product-revenue">{formatCurrency(p.revenue)}</span>
                      <span className="dash-top-product-sold">{p.quantitySold} sold</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="chart-card">
            <div className="dash-panel-header">
              <h2 className="chart-title">Stock Summary</h2>
              <Link to="/dashboard/inventory" className="dash-panel-link">View All</Link>
            </div>
            {stockTotal === 0 ? (
              <p className="empty-hint">No products yet.</p>
            ) : (
              <div className="dash-stock-summary">
                <div className="dash-donut-wrap">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stockPieData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                        {stockPieData.map((entry) => (
                          <Cell key={entry.key} fill={STOCK_COLORS[entry.key]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dash-donut-center">
                    <span className="dash-donut-total">{stockTotal}</span>
                    <span className="dash-donut-total-label">Total Items</span>
                  </div>
                </div>
                <div className="dash-stock-legend">
                  {stockPieData.map((entry) => (
                    <div className="dash-stock-legend-row" key={entry.key}>
                      <span className="dash-stock-legend-dot" style={{ background: STOCK_COLORS[entry.key] }} />
                      <span className="dash-stock-legend-name">{entry.name}</span>
                      <span className="dash-stock-legend-value">
                        {entry.value} ({stockTotal > 0 ? ((entry.value / stockTotal) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
