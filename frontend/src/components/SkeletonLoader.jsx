import './SkeletonLoader.css';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-value"></div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 5 }) {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <div className="skeleton-line"></div>
        </td>
      ))}
    </tr>
  );
}

export default function SkeletonLoader({ type = 'card', count = 4 }) {
  return (
    <div className={`skeleton-grid skeleton-${type}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
