import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { listExpenses, createExpense, deleteExpense } from '../../api/expenses';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

const CATEGORIES = ['rent', 'utilities', 'salaries', 'transport', 'maintenance', 'supplies', 'other'];

const emptyForm = { title: '', amount: '', category: 'other', note: '' };

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listExpenses({ limit: 50 });
      setExpenses(res.data);
    } catch {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createExpense({ ...form, amount: Number(form.amount) });
      toast.success('Expense recorded');
      setForm(emptyForm);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteExpense(deleting._id);
      toast.success('Expense deleted');
      setDeleting(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <h1 className="page-title">Expenses</h1>

      <form className="table-wrap" style={{ padding: '1.25rem', marginBottom: '1.5rem' }} onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label>Title</label>
            <input name="title" value={form.title} onChange={handleChange} required />
          </div>
          <div className="form-field">
            <label>Amount (Rs)</label>
            <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleChange} required />
          </div>
          <div className="form-field">
            <label>Category</label>
            <select name="category" value={form.category} onChange={handleChange}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field" style={{ marginTop: '0.75rem' }}>
          <label>Note</label>
          <input name="note" value={form.note} onChange={handleChange} />
        </div>
        <button className="btn-primary btn-inline" style={{ marginTop: '1rem' }} type="submit" disabled={saving}>
          {saving ? 'Saving...' : '+ Record Expense'}
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-empty">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No expenses recorded.</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e._id}>
                  <td>{new Date(e.date).toLocaleDateString()}</td>
                  <td>{e.title}</td>
                  <td>{e.category}</td>
                  <td>Rs {e.amount}</td>
                  <td className="table-actions">
                    <button className="btn-link btn-link-danger" onClick={() => setDeleting(e)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right' }}>Total</td>
                <td style={{ fontWeight: 700 }}>Rs {total}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {deleting && (
        <ConfirmModal
          title="Delete Expense"
          message={`Are you sure you want to delete expense "${deleting.title}"?`}
          confirmText="Delete Expense"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
