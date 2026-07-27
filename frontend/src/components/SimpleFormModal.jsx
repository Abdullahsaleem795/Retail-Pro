import { useState } from 'react';
import { motion } from 'framer-motion';
import '../pages/dashboard/Inventory.css';

// Generic small-form modal for simple entities (Supplier, Customer, Expense category, etc.)
// driven entirely by a `fields` config, so new CRUD pages don't need bespoke modal code.
export default function SimpleFormModal({ title, fields, initialValues, onSave, onClose }) {
  const buildInitial = () => {
    const values = {};
    fields.forEach((f) => {
      values[f.name] = initialValues?.[f.name] ?? '';
    });
    return values;
  };

  const [form, setForm] = useState(buildInitial);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
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
        <div className="modal-title">{title}</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {fields.map((f) => (
            <div className="form-field" key={f.name}>
              <label>{f.label}</label>
              <input
                name={f.name}
                type={f.type || 'text'}
                value={form[f.name]}
                onChange={handleChange}
                required={f.required}
              />
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
