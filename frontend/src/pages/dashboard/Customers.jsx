import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../api/customers';
import SimpleFormModal from '../../components/SimpleFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

const FIELDS = [
  { name: 'name', label: 'Customer Name', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'address', label: 'Address' },
];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCustomers({ search: search || undefined });
      setCustomers(res.data);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateCustomer(editing._id, payload);
        toast.success('Customer updated');
      } else {
        await createCustomer(payload);
        toast.success('Customer added');
      }
      setModalOpen(false);
      setEditing(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteCustomer(deleting._id);
      toast.success('Customer deleted');
      setDeleting(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <button
          className="btn-primary btn-inline"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + Add Customer
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
              <th>Phone</th>
              <th>Khata Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="table-empty">Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">No customers found.</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c._id}>
                  <td className="truncate" title={c.name}>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>
                    <span className={c.creditBalance > 0 ? 'badge badge-warning' : 'badge badge-ok'}>
                      Rs {c.creditBalance}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button
                      className="btn-link"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button className="btn-link btn-link-danger" onClick={() => setDeleting(c)}>
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
          title={editing ? 'Edit Customer' : 'Add Customer'}
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
          title="Delete Customer"
          message={`Are you sure you want to delete "${deleting.name}"?`}
          confirmText="Delete Customer"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
