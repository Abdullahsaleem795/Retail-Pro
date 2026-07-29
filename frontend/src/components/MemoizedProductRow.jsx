import { memo } from 'react';
import { formatCurrency } from '../utils/format';

const MemoizedProductRow = memo(function ProductRow({ product, onEdit, onDelete }) {
  return (
    <tr>
      <td>{product.name}</td>
      <td>{product.sku || '—'}</td>
      <td>{product.barcode || '—'}</td>
      <td>{product.category?.name || 'Uncategorized'}</td>
      <td>{formatCurrency(product.sellingPrice)}</td>
      <td>
        <span className={product.stockQuantity <= product.lowStockThreshold ? 'badge badge-warning' : 'badge badge-ok'}>
          {product.stockQuantity} {product.unit}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(product)}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(product)}>Delete</button>
        </div>
      </td>
    </tr>
  );
});

export default MemoizedProductRow;
