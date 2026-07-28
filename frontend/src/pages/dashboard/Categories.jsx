import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../../api/categories';
import { listProducts } from '../../api/products';
import SimpleFormModal from '../../components/SimpleFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import { useAuth } from '../../context/useAuth';
import './Inventory.css';

const FIELDS = [
  { name: 'name', label: 'Category Name', required: true },
  { name: 'nameUrdu', label: 'Urdu Name (optional)' },
  { name: 'description', label: 'Description' },
];

export default function Categories() {
  const { can } = useAuth();
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const canManage = can('category:manage');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([listCategories(), listProducts({ limit: 500 })]);
      setCategories(catRes.data);

      // Product counts come from the product list rather than a dedicated
      // endpoint - at SME scale (hundreds of products) that's cheaper than
      // adding an aggregation round-trip.
      const tally = {};
      prodRes.data.forEach((p) => {
        const id = p.categoryId?._id || p.categoryId;
        if (id) tally[id] = (tally[id] || 0) + 1;
      });
      setCounts(tally);
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateCategory(editing._id, payload);
        toast.success('Category updated');
      } else {
        await createCategory(payload);
        toast.success('Category added');
      }
      setModalOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteCategory(deleting._id);
      toast.success('Category deleted');
      setDeleting(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Categories</h1>
        {canManage && (
          <button
            className="btn-primary btn-inline"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Add Category
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Urdu Name</th>
              <th>Description</th>
              <th>Products</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canManage ? 5 : 4} className="table-empty">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={canManage ? 5 : 4} className="table-empty">No categories yet.</td></tr>
            ) : (
              categories.map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.nameUrdu || '—'}</td>
                  <td>{c.description || '—'}</td>
                  <td><span className="badge badge-ok">{counts[c._id] || 0}</span></td>
                  {canManage && (
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
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <SimpleFormModal
          title={editing ? 'Edit Category' : 'Add Category'}
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
          title="Delete Category"
          message={
            counts[deleting._id]
              ? `"${deleting.name}" has ${counts[deleting._id]} product(s). They will become uncategorised. Are you sure?`
              : `Are you sure you want to delete "${deleting.name}"?`
          }
          confirmText="Delete Category"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
