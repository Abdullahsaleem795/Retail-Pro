import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getLowStockAlerts } from '../../api/products';

const stockBadgeClass = (stockQuantity) => (stockQuantity <= 0 ? 'badge badge-danger' : 'badge badge-warning');

const stockLabel = (stockQuantity, unit) =>
  stockQuantity <= 0 ? `Out of stock` : `${stockQuantity} ${unit} left`;

export default function LowStockAlerts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLowStockAlerts()
      .then((res) => setProducts(res.data))
      .catch(() => toast.error('Failed to load low stock alerts'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          Low Stock Alerts
          {!loading && products.length > 0 && (
            <span className="expiry-section-count" style={{ marginLeft: '0.6rem' }}>{products.length}</span>
          )}
        </h1>
      </div>

      {loading ? (
        <p className="table-empty">Loading...</p>
      ) : products.length === 0 ? (
        <p className="table-empty">
          Nothing is low on stock right now. Products land here automatically the moment their stock
          falls at or below the "Low Stock Alert" threshold set in Inventory.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Threshold</th>
                <th>Stock Left</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td className="truncate" title={p.name}>{p.name}</td>
                  <td>{p.sku}</td>
                  <td>{p.lowStockThreshold} {p.unit}</td>
                  <td>
                    <span className={stockBadgeClass(p.stockQuantity)}>
                      {stockLabel(p.stockQuantity, p.unit)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
