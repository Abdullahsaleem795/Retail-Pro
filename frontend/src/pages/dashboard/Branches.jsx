import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  listBranches, createBranch, updateBranch, deleteBranch,
  listTransfers, createTransfer, markTransferInTransit, receiveTransfer, cancelTransfer,
} from '../../api/branches';
import { listProducts } from '../../api/products';
import SimpleFormModal from '../../components/SimpleFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuth } from '../../context/useAuth';
import './Inventory.css';

const BRANCH_FIELDS = [
  { name: 'name', label: 'Branch Name', required: true },
  { name: 'address', label: 'Address' },
  { name: 'phone', label: 'Phone' },
];

const STATUS_BADGE = {
  pending: 'badge-warning',
  in_transit: 'badge-info',
  received: 'badge-ok',
  cancelled: 'badge-danger',
};

function TransferFormModal({ branches, products, onSave, onClose }) {
  const [fromBranchId, setFromBranchId] = useState(branches[0]?._id || '');
  const [toBranchId, setToBranchId] = useState(branches[1]?._id || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems([...items, { productId: '', quantity: 1 }]);
  const removeRow = (idx) => setItems(items.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) =>
    setItems(items.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (fromBranchId === toBranchId) {
      toast.error('Source and destination branches must differ');
      return;
    }
    const cleanItems = items.filter((r) => r.productId && Number(r.quantity) > 0);
    if (cleanItems.length === 0) {
      toast.error('Add at least one product');
      return;
    }
    setSaving(true);
    try {
      await onSave({ fromBranchId, toBranchId, notes, items: cleanItems.map((r) => ({ productId: r.productId, quantity: Number(r.quantity) })) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        style={{ maxWidth: 560 }}
      >
        <div className="modal-title">New Stock Transfer</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>From Branch</label>
            <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>To Branch</label>
            <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <label style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 8 }}>Items</label>
          {items.map((row, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                value={row.productId}
                onChange={(e) => updateRow(idx, 'productId', e.target.value)}
                style={{ flex: 3 }}
              >
                <option value="">Select product...</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.stockQuantity} {p.unit})</option>)}
              </select>
              <input
                type="number"
                min="0.001"
                step="any"
                value={row.quantity}
                onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                style={{ flex: 1 }}
              />
              {items.length > 1 && (
                <button type="button" className="btn-link btn-link-danger" onClick={() => removeRow(idx)}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addRow} style={{ marginBottom: 12 }}>
            + Add Item
          </button>

          <div className="form-field">
            <label>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }} disabled={saving}>
              {saving ? 'Creating...' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function Branches() {
  const { can } = useAuth();
  const [branches, setBranches] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [deletingBranch, setDeletingBranch] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const canManage = can('branch:manage');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchRes, transferRes, productRes] = await Promise.all([
        listBranches(),
        listTransfers(),
        listProducts({ limit: 500 }),
      ]);
      setBranches(branchRes.data);
      setTransfers(transferRes.data);
      setProducts(productRes.data);
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveBranch = async (payload) => {
    try {
      if (editingBranch) {
        await updateBranch(editingBranch._id, payload);
        toast.success('Branch updated');
      } else {
        await createBranch(payload);
        toast.success('Branch added');
      }
      setBranchModalOpen(false);
      setEditingBranch(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    try {
      await deleteBranch(deletingBranch._id);
      toast.success('Branch deleted');
      setDeletingBranch(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed - it may still have transfer history');
    }
  };

  const handleCreateTransfer = async (payload) => {
    try {
      await createTransfer(payload);
      toast.success('Transfer created');
      setTransferModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer');
    }
  };

  const handleTransferAction = async (action, id) => {
    try {
      if (action === 'in-transit') await markTransferInTransit(id);
      if (action === 'receive') await receiveTransfer(id);
      if (action === 'cancel') await cancelTransfer(id);
      toast.success('Transfer updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Branches & Stock Transfers</h1>
        {canManage && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => { setEditingBranch(null); setBranchModalOpen(true); }}>
              + Add Branch
            </button>
            <button
              className="btn-primary btn-inline"
              onClick={() => setTransferModalOpen(true)}
              disabled={branches.length < 2}
              title={branches.length < 2 ? 'Add a second branch first' : ''}
            >
              + New Transfer
            </button>
          </div>
        )}
      </div>

      <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.85rem', marginBottom: 16 }}>
        Transfers are a logistics manifest ("X units moved from Branch A to Branch B") - they don't
        automatically move live stock counts between branches; inventory totals stay shop-wide.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Address</th>
              <th>Phone</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-empty">Loading...</td></tr>
            ) : branches.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No branches yet.</td></tr>
            ) : (
              branches.map((b) => (
                <tr key={b._id}>
                  <td className="truncate" title={b.name}>{b.name} {b.isDefault && <span className="badge badge-ok">Default</span>}</td>
                  <td className="truncate" title={b.address}>{b.address || '—'}</td>
                  <td>{b.phone || '—'}</td>
                  <td>{b.isActive ? <span className="badge badge-ok">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
                  {canManage && (
                    <td className="table-actions">
                      <button className="btn-link" onClick={() => { setEditingBranch(b); setBranchModalOpen(true); }}>Edit</button>
                      {!b.isDefault && (
                        <button className="btn-link btn-link-danger" onClick={() => setDeletingBranch(b)}>Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 32 }}>Transfer Manifests</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Items</th>
              <th>Status</th>
              <th>Created</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No transfers yet.</td></tr>
            ) : (
              transfers.map((t) => (
                <tr key={t._id}>
                  <td className="truncate" title={t.fromBranchId?.name}>{t.fromBranchId?.name}</td>
                  <td className="truncate" title={t.toBranchId?.name}>{t.toBranchId?.name}</td>
                  <td>{t.items?.length || 0} item(s)</td>
                  <td><span className={`badge ${STATUS_BADGE[t.status] || ''}`}>{t.status}</span></td>
                  <td>{new Date(t.createdAt).toLocaleDateString('en-PK')}</td>
                  {canManage && (
                    <td className="table-actions">
                      {t.status === 'pending' && (
                        <button className="btn-link" onClick={() => handleTransferAction('in-transit', t._id)}>Mark In-Transit</button>
                      )}
                      {(t.status === 'pending' || t.status === 'in_transit') && (
                        <>
                          <button className="btn-link" onClick={() => handleTransferAction('receive', t._id)}>Receive</button>
                          <button className="btn-link btn-link-danger" onClick={() => handleTransferAction('cancel', t._id)}>Cancel</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {branchModalOpen && (
        <SimpleFormModal
          title={editingBranch ? 'Edit Branch' : 'Add Branch'}
          fields={BRANCH_FIELDS}
          initialValues={editingBranch}
          onSave={handleSaveBranch}
          onClose={() => { setBranchModalOpen(false); setEditingBranch(null); }}
        />
      )}

      {transferModalOpen && (
        <TransferFormModal
          branches={branches}
          products={products}
          onSave={handleCreateTransfer}
          onClose={() => setTransferModalOpen(false)}
        />
      )}

      {deletingBranch && (
        <ConfirmModal
          title="Delete Branch"
          message={`Are you sure you want to delete "${deletingBranch.name}"? This will fail if it has transfer history.`}
          confirmText="Delete Branch"
          onConfirm={handleDeleteBranch}
          onClose={() => setDeletingBranch(null)}
        />
      )}
    </div>
  );
}
