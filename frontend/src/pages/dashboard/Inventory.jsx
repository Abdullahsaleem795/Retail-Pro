import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../../api/products';
import { listCategories, createCategory } from '../../api/categories';
import ProductFormModal from '../../components/ProductFormModal';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProducts({ search: search || undefined, limit: 100 });
      setProducts(res.data);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.data))
      .catch(() => toast.error('Failed to load categories'));
  }, []);

  const handleSave = async (payload) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct._id, payload);
        toast.success('Product updated');
      } else {
        await createProduct(payload);
        toast.success('Product created');
      }
      setModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      await deleteProduct(deletingProduct._id);
      toast.success('Product deleted');
      setDeletingProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleCreateCategory = async (name) => {
    const res = await createCategory({ name });
    setCategories((prev) => [...prev, res.data]);
    return res.data;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventory</h1>
        <button
          className="btn-primary btn-inline"
          onClick={() => {
            setEditingProduct(null);
            setModalOpen(true);
          }}
        >
          + Add Product
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Search by name, SKU, or barcode..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Cost Price</th>
              <th>Selling Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="table-empty">Loading...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-empty">No products found.</td>
              </tr>
            ) : (
              products.map((p) => {
                const isLowStock = p.stockQuantity <= p.lowStockThreshold;
                return (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.categoryId?.name || '-'}</td>
                    <td>
                      <span className={isLowStock ? 'badge badge-warning' : 'badge badge-ok'}>
                        {p.stockQuantity} {p.unit}
                      </span>
                    </td>
                    <td>Rs {p.costPrice}</td>
                    <td>Rs {p.sellingPrice}</td>
                    <td className="table-actions">
                      <button
                        className="btn-link"
                        onClick={() => {
                          setEditingProduct(p);
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn-link btn-link-danger" onClick={() => setDeletingProduct(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onCreateCategory={handleCreateCategory}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}

      {deletingProduct && (
        <ConfirmModal
          title="Delete Product"
          message={`Are you sure you want to delete "${deletingProduct.name}"? This cannot be undone.`}
          confirmText="Delete Product"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingProduct(null)}
        />
      )}
    </div>
  );
}
