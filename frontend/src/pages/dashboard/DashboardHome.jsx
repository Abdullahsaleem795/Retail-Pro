import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
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
import './DashboardHome.css';

export default function DashboardHome() {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getDashboardOverview();
        const { summary: s, trend: t, bestSellers: b } = res.data;
        setSummary(s);
        setTrend(
          (t || []).map((d) => ({
            date: d._id.slice(5),
            total: d.total,
            transactions: d.transactions,
          }))
        );
        setBestSellers((b || []).map((item) => ({ name: item.name, sold: item.quantitySold })));
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = [
    { label: "Today's Sales", value: formatCurrency(summary?.todaySales), accent: '#22c55e' },
    { label: 'Transactions Today', value: summary?.todayTransactions ?? 0, accent: '#3b82f6' },
    { label: 'Products in Stock', value: summary?.productsInStock ?? 0, accent: '#8b5cf6' },
    { label: 'Stock Value', value: formatCurrency(summary?.stockValue), accent: '#0ea5e9' },
    {
      label: 'Low Stock Items',
      value: summary?.lowStockItems ?? 0,
      accent: '#f59e0b',
      to: '/dashboard/inventory',
    },
    {
      label: 'Pending Purchases',
      value: summary?.pendingPurchases ?? 0,
      accent: '#ef4444',
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

      <div className="stat-grid">
        {stats.map((stat, i) => {
          const card = (
            <motion.div
              className="stat-card"
              style={{ borderTopColor: stat.accent }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <span className="stat-label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
            </motion.div>
          );
          return stat.to ? (
            <Link key={stat.label} to={stat.to} className="stat-link">
              {card}
            </Link>
          ) : (
            <div key={stat.label}>{card}</div>
          );
        })}
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h2 className="chart-title">Sales — Last 14 Days</h2>
          {trend.length === 0 ? (
            <p className="empty-hint">No sales recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} fill="url(#salesFill)" />
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
