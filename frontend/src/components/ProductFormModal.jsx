import { useState } from 'react';
import { motion } from 'framer-motion';
import '../pages/dashboard/Inventory.css';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'dozen', 'box', 'packet'];

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  categoryId: '',
  unit: 'pcs',
  costPrice: '',
  sellingPrice: '',
  stockQuantity: '',
  lowStockThreshold: '10',
};

export default function ProductFormModal({ product, categories, onCreateCategory, onSave, onClose }) {
  const [form, setForm] = useState(
    product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || '',
          categoryId: product.categoryId?._id || product.categoryId || '',
          unit: product.unit,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          stockQuantity: product.stockQuantity,
          lowStockThreshold: product.lowStockThreshold,
        }
      : emptyForm
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const category = await onCreateCategory(newCategoryName.trim());
    setForm({ ...form, categoryId: category._id });
    setNewCategoryName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        stockQuantity: Number(form.stockQuantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        categoryId: form.categoryId || undefined,
        barcode: form.barcode || undefined,
      });
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
      >
        <div className="modal-title">{product ? 'Edit Product' : 'Add Product'}</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Product Name</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>SKU</label>
              <input name="sku" value={form.sku} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>Barcode</label>
              <input name="barcode" value={form.barcode} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Category</label>
              <select name="categoryId" value={form.categoryId} onChange={handleChange}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Unit</label>
              <select name="unit" value={form.unit} onChange={handleChange}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <input
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: 8 }}
            />
            <button type="button" className="btn-secondary" style={{ flex: 'none' }} onClick={handleAddCategory}>
              Add
            </button>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Cost Price (Rs)</label>
              <input name="costPrice" type="number" min="0" step="0.01" value={form.costPrice} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label>Selling Price (Rs)</label>
              <input
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {Number(form.costPrice) > 0 &&
            Number(form.sellingPrice) > 0 &&
            Number(form.sellingPrice) < Number(form.costPrice) && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  marginBottom: '1rem',
                }}
              >
                ⚠️ Warning: Selling price is below cost price (Loss: Rs {(Number(form.costPrice) - Number(form.sellingPrice)).toFixed(2)} / unit)
              </div>
            )}

          <div className="form-row">
            <div className="form-field">
              <label>Stock Quantity</label>
              <input
                name="stockQuantity"
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-field">
              <label>Low Stock Alert</label>
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
