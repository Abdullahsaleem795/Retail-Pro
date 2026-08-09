import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import './TrendStatCard.css';

// Icon-square stat card matching the reference dashboard: colored icon box,
// label + trend badge on top, big value, comparison text below. Distinct
// from StatCard.jsx (sparkline-style, used on Sales/older Dashboard cards) -
// this one is specifically for "vs last week" comparison metrics.
export default function TrendStatCard({ icon: Icon, iconColor, label, value, trend, comparisonLabel, warning }) {
  return (
    <div className="trend-stat-card">
      <div className="trend-stat-icon" style={{ background: iconColor }}>
        <Icon size={20} />
      </div>
      <div className="trend-stat-body">
        <div className="trend-stat-top">
          <span className="trend-stat-label">{label}</span>
          {trend && (
            <span className={`trend-stat-badge ${trend.direction === 'up' ? 'trend-up' : 'trend-down'}`}>
              {trend.direction === 'up' ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />}
              {Math.abs(trend.percent).toFixed(1)}%
            </span>
          )}
        </div>
        <span className="trend-stat-value">{value}</span>
        {warning ? (
          <span className="trend-stat-warning">{warning}</span>
        ) : comparisonLabel ? (
          <span className="trend-stat-comparison">{comparisonLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
