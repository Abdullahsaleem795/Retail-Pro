import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { listPurchases, createPurchase, markPurchaseReceived, cancelPurchase } from '../../api/purchases';
import { listSuppliers } from '../../api/suppliers';
import { listProducts } from '../../api/products';
import { useAuth } from '../../context/useAuth';
import { formatCurrency, formatDate } from '../../utils/format';
import './Inventory.css';

export default function Purchases() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPurchases({ limit: 50 });
      setPurchases(res.data);
    } catch {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
    listSuppliers().then((r) => setSuppliers(r.data)).catch(() => {});
    listProducts({ limit: 200 }).then((r) => setProducts(r.data)).catch(() => {});
  }, [fetchPurchases]);

  const handleReceive = async (purchase) => {
    if (!window.confirm('Mark as received? Stock will be added to inventory.')) return;
    try {
      await markPurchaseReceived(purchase._id);
      toast.success('Purchase received, stock updated');
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to receive purchase');
    }
  };

  const handleCancel = async (purchase) => {
    if (!window.confirm('Cancel this purchase order?')) return;
    try {
      await cancelPurchase(purchase._id);
      toast.success('Purchase cancelled');
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleCreate = async (payload) => {
    try {
      await createPurchase(payload);
      toast.success('Purchase order created');
      setModalOpen(false);
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase');
    }
  };

  const statusBadge = (status) => {
    const map = { received: 'badge-ok', pending: 'badge-warning', cancelled: 'badge-warning' };
    return <span className={`badge ${map[status]}`}>{status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Purchase Orders</h1>
        {canManage && (
          <button className="btn-primary btn-inline" onClick={() => setModalOpen(true)}>
            + New Purchase
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Invoice #</th>
              <th>Items</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="table-empty">Loading...</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={8} className="table-empty">No purchase orders yet.</td></tr>
            ) : (
              purchases.map((p) => (
                <tr key={p._id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{p.supplierId?.name || '-'}</td>
                  <td>{p.invoiceNumber || '-'}</td>
                  <td>{p.items.length}</td>
                  <td>{formatCurrency(p.totalAmount)}</td>
                  <td>{formatCurrency(p.amountPaid)}</td>
                  <td>{statusBadge(p.status)}</td>
                  <td className="table-actions">
                    {canManage && p.status === 'pending' && (
                      <>
                        <button className="btn-link" onClick={() => handleReceive(p)}>Receive</button>
                        <button className="btn-link btn-link-danger" onClick={() => handleCancel(p)}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <PurchaseFormModal
          suppliers={suppliers}
          products={products}
          onSave={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function PurchaseFormModal({ suppliers, products, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, costPrice: 0 }]);

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, [field]: value };
        // Prefill cost price from the product record when a product is picked
        if (field === 'productId') {
          const product = products.find((p) => p._id === value);
          if (product) next.costPrice = product.costPrice;
        }
        return next;
      })
    );
  };

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const total = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.costPrice), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0 || items.some((i) => !i.productId)) {
      toast.error('Add at least one product line');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        amountPaid: Number(amountPaid) || 0,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice),
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card"
        style={{ maxWidth: 600 }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-title">New Purchase Order</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label>Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Invoice #</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
          </div>

          <div className="purchase-items">
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Items</label>
            {items.map((item, index) => (
              <div className="purchase-item-row" key={index}>
                <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)}>
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  placeholder="Qty"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.costPrice}
                  onChange={(e) => updateItem(index, 'costPrice', e.target.value)}
                  placeholder="Cost"
                />
                <button type="button" className="pos-remove-btn" onClick={() => removeItem(index)}>&times;</button>
              </div>
            ))}
            <button type="button" className="btn-link" onClick={addItem} style={{ marginTop: '0.5rem' }}>
              + Add item
            </button>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Amount Paid (Rs)</label>
              <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Order Total</label>
              <input value={formatCurrency(total)} readOnly style={{ background: '#f8fafc' }} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }} disabled={saving}>
              {saving ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
