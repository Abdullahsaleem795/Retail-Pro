import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/suppliers';
import { sendSupplierOrderDraft } from '../../api/notifications';
import SimpleFormModal from '../../components/SimpleFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

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

  const handleWhatsAppOrder = async (supplier) => {
    try {
      const res = await sendSupplierOrderDraft(supplier._id);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
        toast.success('Opened WhatsApp draft');
      } else {
        toast.success('Order draft generated');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'No low stock items for this supplier');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <button
          className="btn-primary btn-inline"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + Add Supplier
        </button>
      </div>

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
              <th>Balance Owed</th>
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
                  <td>{s.name}</td>
                  <td>{s.contactPerson || '-'}</td>
                  <td>{s.phone}</td>
                  <td>
                    <span className={s.balance > 0 ? 'badge badge-warning' : 'badge badge-ok'}>
                      Rs {s.balance}
                    </span>
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
