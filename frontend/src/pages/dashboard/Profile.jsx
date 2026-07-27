import { useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { updateProfile, changePassword } from '../../api/client';
import { useAuth } from '../../context/useAuth';
import './Inventory.css';
import './DashboardHome.css';

const PERMISSION_LABELS = {
  'product:manage': 'Manage products',
  'category:manage': 'Manage categories',
  'supplier:manage': 'Manage suppliers',
  'purchase:manage': 'Manage purchases',
  'expense:manage': 'Record expenses',
  'sale:refund': 'Refund sales',
  'report:view': 'View reports',
  'staff:manage': 'Manage staff',
  'shop:settings': 'Change shop settings',
  'notification:send': 'Send WhatsApp alerts',
};

export default function Profile() {
  const { user, permissions, refreshUser } = useAuth();
  const [details, setDetails] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [savingDetails, setSavingDetails] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      await updateProfile(details);
      toast.success('Profile updated');
      refreshUser?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pw.currentPassword, pw.newPassword);
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">My Profile</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <form className="table-wrap" style={{ padding: '1.5rem', marginBottom: '1.25rem' }} onSubmit={handleDetailsSubmit}>
          <h2 className="chart-title">Your Details</h2>

          <div className="form-row">
            <div className="form-field">
              <label>Name</label>
              <input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} required />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '0.85rem' }}>
            <div className="form-field">
              <label>Email</label>
              <input value={user?.email || ''} readOnly style={{ background: '#f8fafc' }} />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Ask the shop owner to change your email.
              </span>
            </div>
            <div className="form-field">
              <label>Role</label>
              <input value={user?.role || ''} readOnly style={{ background: '#f8fafc' }} />
            </div>
          </div>

          <button className="btn-primary btn-inline" style={{ marginTop: '1.1rem' }} type="submit" disabled={savingDetails}>
            {savingDetails ? 'Saving...' : 'Save Details'}
          </button>
        </form>

        <form className="table-wrap" style={{ padding: '1.5rem', marginBottom: '1.25rem' }} onSubmit={handlePasswordSubmit}>
          <h2 className="chart-title">Change Password</h2>

          <div className="form-field">
            <label>Current Password</label>
            <input
              type="password"
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              required
            />
          </div>

          <div className="form-row" style={{ marginTop: '0.85rem' }}>
            <div className="form-field">
              <label>New Password</label>
              <input
                type="password"
                minLength={6}
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label>Confirm New Password</label>
              <input
                type="password"
                minLength={6}
                value={pw.confirmPassword}
                onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <button className="btn-primary btn-inline" style={{ marginTop: '1.1rem' }} type="submit" disabled={savingPw}>
            {savingPw ? 'Updating...' : 'Change Password'}
          </button>
        </form>

        <div className="table-wrap" style={{ padding: '1.5rem' }}>
          <h2 className="chart-title">What You Can Do</h2>
          {permissions?.length ? (
            <div className="perm-grid" style={{ border: 'none', padding: 0 }}>
              {permissions.map((p) => (
                <span key={p} className="badge badge-ok" style={{ justifySelf: 'start' }}>
                  {PERMISSION_LABELS[p] || p}
                </span>
              ))}
            </div>
          ) : (
            <p className="report-period" style={{ margin: 0 }}>
              You can ring up sales and look up products. Ask the shop owner if you need more access.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
