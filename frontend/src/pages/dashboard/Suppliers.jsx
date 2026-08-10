import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/suppliers';
import { sendSupplierOrderDraft } from '../../api/notifications';
import { formatCurrency } from '../../utils/format';
import SimpleFormModal from '../../components/SimpleFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

// A filled badge/pill reads fine for a short status word, but for a currency
// figure it looks like a sticker rather than a ledger value - plain weighted
// text, colored only when there's actually something owed, reads calmer and
// more like an accounting table.
const balanceStyle = (balance) => ({
  fontWeight: 600,
  color: balance > 0 ? '#b45309' : '#64748b',
});

const FIELDS = [
  { name: 'name', label: 'Supplier Name', required: true },
  { name: 'contactPerson', label: 'Contact Person' },
  { name: 'phone', label: 'Phone', required: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'address', label: 'Address' },
];

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSuppliers({ search: search || undefined });
      setSuppliers(res.data);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateSupplier(editing._id, payload);
        toast.success('Supplier updated');
      } else {
        await createSupplier(payload);
        toast.success('Supplier added');
      }
      setModalOpen(false);
      setEditing(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteSupplier(deleting._id);
      toast.success('Supplier deleted');
      setDeleting(null);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // This button only auto-drafts a restock message for products that are (a)
  // linked to this supplier in Inventory ("Edit Product" > Supplier) and (b)
  // currently at/below their low stock threshold - it's a shortcut for
  // reordering what's already running low, not a general "place any order"
  // tool. For a one-off or full order (any product, any quantity, doesn't
  // need to be low), that's the Purchases page.
  const handleWhatsAppOrder = async (supplier) => {
    try {
      const res = await sendSupplierOrderDraft(supplier._id);
      if (res.deliveryStatus === 'sent') {
        toast.success('Order sent to supplier on WhatsApp');
      } else if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
        toast.success('Opened WhatsApp draft');
      } else {
        toast.success('Order draft generated');
      }
    } catch (err) {
      if (err.response?.status === 400) {
        toast.error(
          'No low-stock products are linked to this supplier. Link products to them in Inventory (Edit Product → Supplier), or place a manual order from Purchases.',
          { duration: 6000 }
        );
      } else {
        toast.error(err.response?.data?.message || 'Failed to generate order');
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <div className="page-header-actions">
          <Link to="/dashboard/purchases" className="btn-secondary btn-inline">
            Place an Order
          </Link>
          <button
            className="btn-primary btn-inline"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Add Supplier
          </button>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '-0.5rem 0 1rem' }}>
        The 💬 Order button below only drafts a WhatsApp message for products already running low that
        are linked to that supplier. To order anything else, or in any quantity, use "Place an Order".
      </p>

      <input
        className="search-input"
        placeholder="Search by name or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}>Balance Owed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-empty">Loading...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No suppliers found.</td></tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s._id}>
                  <td className="truncate" title={s.name}>{s.name}</td>
                  <td className="truncate" title={s.contactPerson}>{s.contactPerson || '-'}</td>
                  <td>{s.phone}</td>
                  <td style={{ textAlign: 'right', ...balanceStyle(s.balance) }}>
                    {formatCurrency(s.balance)}
                  </td>
                  <td className="table-actions">
                    <button className="btn-link" onClick={() => handleWhatsAppOrder(s)} style={{ color: '#22c55e', fontWeight: 600 }}>
                      💬 Order
                    </button>
                    <button
                      className="btn-link"
                      onClick={() => {
                        setEditing(s);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-link btn-link-danger" onClick={() => setDeleting(s)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SimpleFormModal
          title={editing ? 'Edit Supplier' : 'Add Supplier'}
          fields={FIELDS}
          initialValues={editing}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Supplier"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          confirmText="Delete Supplier"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
