import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getGrantablePermissions,
} from '../../api/shop';
import { useAuth } from '../../context/useAuth';
import { formatDateTime } from '../../utils/format';
import ConfirmModal from '../../components/ConfirmModal';
import './Inventory.css';

const ROLES = ['cashier', 'manager'];

// Human labels for the permission slugs the API returns
const PERMISSION_LABELS = {
  'product:manage': 'Manage products',
  'category:manage': 'Manage categories',
  'supplier:manage': 'Manage suppliers',
  'purchase:manage': 'Manage purchases',
  'expense:manage': 'Record expenses',
  'sale:refund': 'Refund sales',
  'report:view': 'View reports',
  'notification:send': 'Send WhatsApp alerts',
};

export default function Staff() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [grantable, setGrantable] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    getGrantablePermissions()
      .then((res) => {
        setGrantable(res.grantablePermissions || []);
        setRoleDefaults(res.roleDefaults || {});
      })
      .catch(() => toast.error('Failed to load permission definitions'));
  }, [fetchUsers]);

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateUser(editing._id, payload);
        toast.success('Staff member updated');
      } else {
        await createUser(payload);
        toast.success('Staff member added');
      }
      setModalOpen(false);
      setEditing(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting._id);
      toast.success('Staff member removed');
      setDeleting(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleToggleActive = async (target) => {
    try {
      await updateUser(target._id, { isActive: !target.isActive });
      toast.success(target.isActive ? 'Access suspended' : 'Access restored');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Staff</h1>
        <button
          className="btn-primary btn-inline"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          + Add Staff
        </button>
      </div>

      <p className="report-period">
        Cashiers can ring up sales and look up stock. Managers can also manage inventory, purchases and
        refunds. You can grant a cashier extra abilities individually without promoting them.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Extra Permissions</th>
              <th>Last Login</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="table-empty">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="table-empty">No staff yet.</td></tr>
            ) : (
              users.map((u) => {
                const isSelf = u._id === user?.id || u._id === user?._id;
                const isOwner = u.role === 'owner';
                return (
                  <tr key={u._id}>
                    <td>{u.name}{isSelf && ' (you)'}</td>
                    <td>{u.email}</td>
                    <td><span className="badge badge-ok">{u.role}</span></td>
                    <td>
                      {isOwner ? (
                        <span style={{ color: '#94a3b8' }}>full access</span>
                      ) : u.permissions?.length ? (
                        u.permissions.map((p) => PERMISSION_LABELS[p] || p).join(', ')
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'never'}</td>
                    <td>
                      <span className={u.isActive ? 'badge badge-ok' : 'badge badge-danger'}>
                        {u.isActive ? 'active' : 'suspended'}
                      </span>
                    </td>
                    <td className="table-actions">
                      {isOwner ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>owner account</span>
                      ) : (
                        <>
                          <button
                            className="btn-link"
                            onClick={() => {
                              setEditing(u);
                              setModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button className="btn-link" onClick={() => handleToggleActive(u)}>
                            {u.isActive ? 'Suspend' : 'Restore'}
                          </button>
                          <button className="btn-link btn-link-danger" onClick={() => setDeleting(u)}>
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <StaffFormModal
          staff={editing}
          grantable={grantable}
          roleDefaults={roleDefaults}
          onSave={handleSave}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Remove Staff Member"
          message={`Are you sure you want to remove ${deleting.name} from this shop?`}
          confirmText="Remove Staff"
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function StaffFormModal({ staff, grantable, roleDefaults, onSave, onClose }) {
  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    password: '',
    phone: staff?.phone || '',
    role: staff?.role || 'cashier',
  });
  const [permissions, setPermissions] = useState(staff?.permissions || []);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const togglePermission = (perm) =>
    setPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone, role: form.role, permissions };
      if (!staff) {
        payload.email = form.email;
        payload.password = form.password;
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  // Permissions the chosen role already includes are shown checked and disabled,
  // so it's obvious they're inherited rather than individually granted.
  const inherited = roleDefaults?.[form.role] || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="modal-title">{staff ? 'Edit Staff Member' : 'Add Staff Member'}</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Name</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>

          {!staff && (
            <>
              <div className="form-field">
                <label>Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-field">
                <label>Temporary Password</label>
                <input
                  name="password"
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Share this with them and ask them to change it from their Profile page.
                </span>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-field">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="form-field">
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Extra Permissions</label>
            <div className="perm-grid">
              {grantable.map((perm) => {
                const isInherited = inherited.includes(perm);
                return (
                  <label key={perm} className={isInherited ? 'perm-item perm-item-inherited' : 'perm-item'}>
                    <input
                      type="checkbox"
                      checked={isInherited || permissions.includes(perm)}
                      disabled={isInherited}
                      onChange={() => togglePermission(perm)}
                    />
                    <span>{PERMISSION_LABELS[perm] || perm}</span>
                    {isInherited && <em>from role</em>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
