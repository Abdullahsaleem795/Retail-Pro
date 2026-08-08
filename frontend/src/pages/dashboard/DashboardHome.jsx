import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import toast from 'react-hot-toast';
import { getDashboardOverview } from '../../api/reports';
import { formatCurrency } from '../../utils/format';
import SkeletonLoader from '../../components/SkeletonLoader';
import StatCard from '../../components/StatCard';
import './DashboardHome.css';

// Builds a chronological, zero-filled 14-day array from the trend rows the
// API returns (which only include days that actually had a sale) - both the
// big trend chart and the stat-card sparklines need a value for EVERY day,
// not just the ones with data. Without this, Recharts' categorical x-axis
// spaces the sparse real days evenly regardless of the actual gap between
// them, which draws a misleadingly smooth line straight across what was
// really a 10-day quiet stretch instead of showing it as quiet.
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

export default function DashboardHome() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [hasSalesHistory, setHasSalesHistory] = useState(false);
  const [salesSpark, setSalesSpark] = useState([]);
  const [txnSpark, setTxnSpark] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getDashboardOverview();
        const { summary: s, trend: t, bestSellers: b } = res.data;
        const rawTrend = t || [];
        const filled = zeroFill14Days(rawTrend);
        setSummary(s);
        setTrend(filled);
        setHasSalesHistory(rawTrend.length > 0);
        setSalesSpark(filled.map((d) => d.total));
        setTxnSpark(filled.map((d) => d.transactions));
        setBestSellers((b || []).map((item) => ({ name: item.name, sold: item.quantitySold })));
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Only the two sales-derived cards get a real sparkline - it comes from an
  // actual 14-day daily series. The rest (stock counts/value, pending
  // purchases) are point-in-time snapshots with no history behind them, so
  // they render without one instead of faking a trend line.
  const stats = [
    {
      label: "Today's Sales",
      value: formatCurrency(summary?.todaySales),
      period: 'Today',
      sparkline: salesSpark,
      sparklineColor: '#16a34a',
      gradient: true,
    },
    {
      label: 'Transactions Today',
      value: summary?.todayTransactions ?? 0,
      period: 'Today',
      sparkline: txnSpark,
      sparklineColor: '#3b82f6',
    },
    { label: 'Products in Stock', value: summary?.productsInStock ?? 0, period: 'Live' },
    { label: 'Stock Value', value: formatCurrency(summary?.stockValue), period: 'Live' },
    {
      label: 'Low Stock Items',
      value: summary?.lowStockItems ?? 0,
      period: 'Live',
      to: '/dashboard/inventory',
    },
    {
      label: 'Pending Purchases',
      value: summary?.pendingPurchases ?? 0,
      period: 'Live',
      to: '/dashboard/purchases',
    },
  ];

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Dashboard</h1>
        <SkeletonLoader type="card" count={6} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-grid dashboard-stat-grid">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h2 className="chart-title">Sales — Last 14 Days</h2>
          {!hasSalesHistory ? (
            <p className="empty-hint">No sales recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
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
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Best Sellers — Last 30 Days</h2>
          {bestSellers.length === 0 ? (
            <p className="empty-hint">Not enough sales data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bestSellers} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="sold" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
