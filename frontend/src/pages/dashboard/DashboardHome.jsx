import { motion } from 'framer-motion';
import './DashboardHome.css';

const STATS = [
  { label: "Today's Sales", value: 'Rs 0', accent: '#22c55e' },
  { label: 'Products in Stock', value: '0', accent: '#3b82f6' },
  { label: 'Low Stock Items', value: '0', accent: '#f59e0b' },
  { label: 'Pending Purchases', value: '0', accent: '#8b5cf6' },
];

export default function DashboardHome() {
  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="stat-grid">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            style={{ borderTopColor: stat.accent }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
          >
            <span className="stat-label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
          </motion.div>
        ))}
      </div>
      <p className="empty-hint">
        Connect your inventory to start seeing live sales, stock, and profit data here.
      </p>
    </div>
  );
}
