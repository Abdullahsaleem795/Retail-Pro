import { Link } from 'react-router-dom';
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';
import './StatCard.css';

// Matches the reference dashboard's stat-card style: muted label, a static
// period tag ("This month"), a big bold value, and an optional sparkline.
// The sparkline is opt-in via `sparkline` - only pass it for metrics that
// actually have a real daily time series behind them (e.g. sales trend).
// Point-in-time snapshots (stock value, low-stock count) render without one
// rather than fake a trend line for data that doesn't exist.
//
// Bars instead of a smoothed line/area: a real shop's daily totals are
// naturally spiky (a few good days, several quiet ones), and a zero-filled
// 14-day *line* threading through a run of zero days reads as a jagged
// spike-then-flat-line shape - it looks broken even though the data is
// correct. Discrete daily bars represent that same gappy data as normal,
// clean-looking "quiet day" bars instead.
export default function StatCard({ label, value, period, sparkline, sparklineColor = '#22c55e', gradient, to }) {
  const card = (
    <div className={`stat-card-v2${gradient ? ' stat-card-v2-gradient' : ''}`}>
      <div className="stat-card-v2-top">
        <span className="stat-card-v2-label">{label}</span>
        {period && <span className="stat-card-v2-period">{period}</span>}
      </div>
      <span className="stat-card-v2-value">{value}</span>
      {sparkline && sparkline.length > 1 && (
        <div className="stat-card-v2-spark">
          <ResponsiveContainer width="100%" height={40}>
            <BarChart data={sparkline.map((v) => ({ v }))} barCategoryGap="32%">
              <Bar dataKey="v" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {sparkline.map((_, i) => (
                  // Older days fade slightly - draws the eye toward today's
                  // bar (the last one) without needing a separate label.
                  <Cell key={i} fill={sparklineColor} fillOpacity={0.35 + (0.6 * (i + 1)) / sparkline.length} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="stat-card-v2-link">
      {card}
    </Link>
  ) : (
    card
  );
}
