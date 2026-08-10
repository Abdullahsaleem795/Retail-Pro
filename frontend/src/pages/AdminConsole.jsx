import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import './AdminConsole.css';

// Deliberately a standalone axios instance, not the shared apiClient - this
// page authenticates with an admin key header, not a shop-scoped JWT, and
// must never attach/refresh a user's access token.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const adminClient = axios.create({ baseURL: API_BASE });

const PLANS = ['basic', 'pro', 'enterprise'];

const STATUS_LABELS = {
  active: 'Active',
  pending_activation: 'Pending',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

function KeyGate({ onUnlock }) {
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setChecking(true);
    try {
      await adminClient.get('/admin/shops', { headers: { 'x-admin-key': key } });
      sessionStorage.setItem('retailpro_admin_key', key);
      onUnlock(key);
    } catch {
      toast.error('Invalid admin key');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="admin-console">
      <Toaster position="top-right" />
      <div className="ac-gate">
        <form className="ac-gate-card" onSubmit={handleSubmit}>
          <div className="ac-gate-mark">RP</div>
          <h1>Platform Console</h1>
          <p>Operator access only. Enter the key configured on the backend to continue.</p>
          <label htmlFor="admin-key">Admin key</label>
          <input
            id="admin-key"
            className="ac-input"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your PLATFORM_ADMIN_KEY"
            autoFocus
          />
          <button type="submit" className="ac-btn ac-btn-primary ac-btn-block" disabled={checking || !key}>
            {checking ? 'Checking...' : 'Unlock console'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ShopRow({ shop, adminKey, onChanged }) {
  const [plan, setPlan] = useState('pro');
  const [months, setMonths] = useState(1);
  const [complimentary, setComplimentary] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const isFreeGrant = (shop.lastPaymentTrx || '').startsWith('Free grant');

  const activate = async () => {
    setBusy(true);
    try {
      await adminClient.post(
        `/admin/shops/${shop._id}/subscription/activate`,
        { plan, durationMonths: Number(months), complimentary, note: note.trim() || undefined },
        { headers: { 'x-admin-key': adminKey } }
      );
      toast.success(
        complimentary ? `${shop.name} given free ${plan} access` : `${shop.name} activated on ${plan}`
      );
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await adminClient.post(
        `/admin/shops/${shop._id}/subscription/reject`,
        { reason: 'Payment not verified' },
        { headers: { 'x-admin-key': adminKey } }
      );
      toast.success(`${shop.name} request rejected`);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <div className="ac-shop-name">{shop.name}</div>
      </td>
      <td>
        <span className="ac-owner-name">{shop.ownerName}</span>
        <span className="ac-owner-phone">{shop.phone}</span>
      </td>
      <td>
        <span className="ac-plan-pill">{shop.subscriptionPlan}</span>
      </td>
      <td>
        <span className={`ac-status-pill ac-status-${shop.subscriptionStatus}`}>
          {STATUS_LABELS[shop.subscriptionStatus] || shop.subscriptionStatus}
        </span>
      </td>
      <td>
        {isFreeGrant ? (
          <span className="ac-free-badge" title={shop.lastPaymentTrx}>Free grant</span>
        ) : shop.lastPaymentTrx ? (
          <span className="ac-ref" title={shop.lastPaymentTrx}>{shop.lastPaymentTrx}</span>
        ) : (
          <span className="ac-ref">—</span>
        )}
      </td>
      <td>
        <div className="ac-activation">
          <div className="ac-activation-row">
            <select className="ac-select" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
              {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <label className="ac-duration">
              <input
                type="number" min="1" value={months}
                onChange={(e) => setMonths(e.target.value)}
                aria-label="Duration in months"
              />
              <span>mo</span>
            </label>
          </div>

          <label className="ac-free-toggle">
            <input
              type="checkbox"
              checked={complimentary}
              onChange={(e) => setComplimentary(e.target.checked)}
            />
            Free grant, no payment
          </label>

          {complimentary && (
            <input
              className="ac-note-input"
              type="text"
              placeholder="Reason (optional) - e.g. beta tester, friend"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          <div className="ac-activation-actions">
            <button
              className={`ac-btn ac-btn-sm ${complimentary ? 'ac-btn-free' : 'ac-btn-primary'}`}
              onClick={activate}
              disabled={busy}
            >
              {complimentary ? 'Grant Free Access' : 'Activate'}
            </button>
            <button className="ac-btn ac-btn-danger ac-btn-sm" onClick={reject} disabled={busy}>
              Reject
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// Editable operator receiving accounts, shown on every shop's Settings page
// (GET /api/shop/payment-accounts) via the upgrade-request screen. Previously
// hardcoded straight into Settings.jsx - changing a JazzCash number meant a
// code change and redeploy. Now a normal admin-key-gated form.
function PaymentAccountsCard({ adminKey }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await adminClient.get('/admin/payment-accounts', { headers: { 'x-admin-key': adminKey } });
      setForm(data.data || {});
    } catch {
      toast.error('Could not load payment accounts');
    }
  }, [adminKey]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminClient.put('/admin/payment-accounts', form, { headers: { 'x-admin-key': adminKey } });
      toast.success('Payment accounts updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  return (
    <div className="ac-table-card ac-payment-card">
      <div className="ac-payment-head">
        <h2>Payment Accounts</h2>
        <p>Shown to every shop on their Settings page when requesting a plan upgrade. Leave a section blank to hide it.</p>
      </div>
      <form onSubmit={handleSave} className="ac-payment-form">
        <div className="ac-payment-group">
          <span className="ac-payment-group-label">JazzCash</span>
          <div className="ac-payment-row">
            <label>
              Account title
              <input className="ac-input" value={form.jazzcashTitle || ''} onChange={set('jazzcashTitle')} placeholder="Abdullah Saleem" />
            </label>
            <label>
              Account number
              <input className="ac-input" value={form.jazzcashNumber || ''} onChange={set('jazzcashNumber')} placeholder="923001234567" />
            </label>
          </div>
        </div>

        <div className="ac-payment-group">
          <span className="ac-payment-group-label">EasyPaisa</span>
          <div className="ac-payment-row">
            <label>
              Account title
              <input className="ac-input" value={form.easypaisaTitle || ''} onChange={set('easypaisaTitle')} placeholder="Abdullah Saleem" />
            </label>
            <label>
              Account number
              <input className="ac-input" value={form.easypaisaNumber || ''} onChange={set('easypaisaNumber')} placeholder="923001234567" />
            </label>
          </div>
        </div>

        <div className="ac-payment-group">
          <span className="ac-payment-group-label">Notifications</span>
          <div className="ac-payment-row">
            <label>
              Admin notification email
              <input
                className="ac-input"
                type="email"
                value={form.notifyEmail || ''}
                onChange={set('notifyEmail')}
                placeholder="you@example.com"
              />
            </label>
          </div>
          <p className="ac-payment-hint">
            Sent an email here every time a shop submits a Pro/Enterprise upgrade request, naming who purchased it.
          </p>
        </div>

        <div className="ac-payment-group">
          <span className="ac-payment-group-label">Bank Transfer</span>
          <div className="ac-payment-row ac-payment-row-3">
            <label>
              Account title
              <input className="ac-input" value={form.bankTitle || ''} onChange={set('bankTitle')} placeholder="RetailPro Software" />
            </label>
            <label>
              Bank name
              <input className="ac-input" value={form.bankName || ''} onChange={set('bankName')} placeholder="Meezan / HBL" />
            </label>
            <label>
              IBAN
              <input className="ac-input" value={form.bankIban || ''} onChange={set('bankIban')} placeholder="PK89MEZN0001092837492019" />
            </label>
          </div>
        </div>

        <button type="submit" className="ac-btn ac-btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving...' : 'Save Payment Accounts'}
        </button>
      </form>
    </div>
  );
}

export default function AdminConsole() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('retailpro_admin_key') || '');
  const [shops, setShops] = useState([]);
  const [filter, setFilter] = useState('pending_activation');
  const [loading, setLoading] = useState(false);

  const fetchShops = useCallback(async (key) => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const { data } = await adminClient.get('/admin/shops', { headers: { 'x-admin-key': key }, params });
      setShops(data.data);
    } catch {
      toast.error('Session expired or invalid key');
      sessionStorage.removeItem('retailpro_admin_key');
      setAdminKey('');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (adminKey) fetchShops(adminKey);
  }, [adminKey, fetchShops]);

  if (!adminKey) {
    return <KeyGate onUnlock={setAdminKey} />;
  }

  const tabs = [
    { value: 'pending_activation', label: 'Pending Activation' },
    { value: '', label: 'All Shops' },
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
  ];

  return (
    <div className="admin-console">
      <Toaster position="top-right" />
      <div className="ac-shell">
        <div className="ac-header">
          <div className="ac-header-title">
            <div>
              <h1>Platform Console</h1>
              <p>Cross-tenant subscription management — not part of any shop's dashboard.</p>
            </div>
          </div>
          <button
            className="ac-btn ac-btn-ghost"
            onClick={() => { sessionStorage.removeItem('retailpro_admin_key'); setAdminKey(''); }}
          >
            Lock
          </button>
        </div>

        <div className="ac-tabs">
          {tabs.map((f) => (
            <button
              key={f.value}
              className={`ac-tab ${filter === f.value ? 'is-active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ac-table-card">
          <div className="ac-table-scroll">
            <table className="ac-table">
              <colgroup>
                <col className="col-shop" />
                <col className="col-owner" />
                <col className="col-plan" />
                <col className="col-status" />
                <col className="col-ref" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Payment Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="ac-loading">Loading...</td></tr>
                ) : shops.length === 0 ? (
                  <tr><td colSpan={6} className="ac-empty">No shops in this view.</td></tr>
                ) : (
                  shops.map((s) => <ShopRow key={s._id} shop={s} adminKey={adminKey} onChanged={() => fetchShops(adminKey)} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        <PaymentAccountsCard adminKey={adminKey} />
      </div>
    </div>
  );
}
