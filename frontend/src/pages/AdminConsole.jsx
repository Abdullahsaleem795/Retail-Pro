import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import PaymentMonogram from '../components/PaymentMonogram';
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

        <button type="submit" className="ac-btn ac-btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving...' : 'Save Payment Accounts'}
        </button>
      </form>
    </div>
  );
}

const EMPTY_BANK = { bankName: '', accountTitle: '', iban: '', accountNumber: '' };

// Bank accounts are a LIST, not a single record - a shop owner picks which one
// to transfer into on their upgrade screen, so the operator needs to be able
// to advertise several (the old single-bank form could only hold one, which is
// why the live row had "Meezan / HBL" crammed into one name field).
function BankAccountsCard({ adminKey }) {
  const [banks, setBanks] = useState([]);
  const [draft, setDraft] = useState(EMPTY_BANK);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);

  const headers = { headers: { 'x-admin-key': adminKey } };

  const fetchBanks = useCallback(async () => {
    try {
      const { data } = await adminClient.get('/admin/bank-accounts', { headers: { 'x-admin-key': adminKey } });
      setBanks(data.data || []);
    } catch {
      toast.error('Could not load bank accounts');
    }
  }, [adminKey]);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const editField = (id, field) => (e) =>
    setBanks((prev) => prev.map((b) => (b._id === id ? { ...b, [field]: e.target.value } : b)));

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await adminClient.post('/admin/bank-accounts', draft, headers);
      toast.success(`${draft.bankName} added`);
      setDraft(EMPTY_BANK);
      fetchBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add bank');
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (bank) => {
    setBusyId(bank._id);
    try {
      await adminClient.put(`/admin/bank-accounts/${bank._id}`, bank, headers);
      toast.success('Bank account updated');
      fetchBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (bank) => {
    setBusyId(bank._id);
    try {
      await adminClient.delete(`/admin/bank-accounts/${bank._id}`, headers);
      toast.success(`${bank.bankName} removed`);
      fetchBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remove failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ac-table-card ac-payment-card">
      <div className="ac-payment-head">
        <h2>Bank Accounts</h2>
        <p>Every bank listed here appears on each shop&apos;s upgrade screen, where the owner picks which one to transfer into.</p>
      </div>

      <div className="ac-payment-form">
        {banks.length === 0 && (
          <p className="ac-payment-hint" style={{ margin: 0 }}>
            No banks added yet — shops will only see JazzCash / EasyPaisa until you add one.
          </p>
        )}

        {banks.map((bank) => (
          <div className="ac-payment-group" key={bank._id}>
            {/* Same monogram the shop sees on its upgrade screen, so the
                operator is looking at the same mark the customer is. */}
            <span className="ac-bank-heading">
              <PaymentMonogram name={bank.bankName} size={28} className="ac-bank-mark" />
              <span className="ac-payment-group-label" style={{ margin: 0 }}>{bank.bankName || 'Untitled bank'}</span>
            </span>
            <div className="ac-payment-row ac-payment-row-4">
              <label>
                Bank name
                <input className="ac-input" value={bank.bankName || ''} onChange={editField(bank._id, 'bankName')} placeholder="Meezan Bank" />
              </label>
              <label>
                Account title
                <input className="ac-input" value={bank.accountTitle || ''} onChange={editField(bank._id, 'accountTitle')} placeholder="RetailPro Software" />
              </label>
              <label>
                IBAN
                <input className="ac-input" value={bank.iban || ''} onChange={editField(bank._id, 'iban')} placeholder="PK89MEZN0001092837492019" />
              </label>
              <label>
                Account number
                <input className="ac-input" value={bank.accountNumber || ''} onChange={editField(bank._id, 'accountNumber')} placeholder="0109-2837492019" />
              </label>
            </div>
            <div className="ac-bank-actions">
              <button className="ac-btn ac-btn-primary ac-btn-sm" onClick={() => handleSave(bank)} disabled={busyId === bank._id}>
                Save
              </button>
              <button className="ac-btn ac-btn-danger ac-btn-sm" onClick={() => handleDelete(bank)} disabled={busyId === bank._id}>
                Remove
              </button>
            </div>
          </div>
        ))}

        <form className="ac-payment-group" onSubmit={handleAdd}>
          <span className="ac-payment-group-label">Add a bank</span>
          <div className="ac-payment-row ac-payment-row-4">
            <label>
              Bank name
              <input className="ac-input" value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} placeholder="HBL" required />
            </label>
            <label>
              Account title
              <input className="ac-input" value={draft.accountTitle} onChange={(e) => setDraft({ ...draft, accountTitle: e.target.value })} placeholder="RetailPro Software" required />
            </label>
            <label>
              IBAN
              <input className="ac-input" value={draft.iban} onChange={(e) => setDraft({ ...draft, iban: e.target.value })} placeholder="PK89HABB0001092837492019" />
            </label>
            <label>
              Account number
              <input className="ac-input" value={draft.accountNumber} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} placeholder="0109-2837492019" />
            </label>
          </div>
          <p className="ac-payment-hint">Provide at least an IBAN or an account number.</p>
          <button type="submit" className="ac-btn ac-btn-primary ac-btn-sm" disabled={adding} style={{ alignSelf: 'flex-start', marginTop: 'var(--space-3)' }}>
            {adding ? 'Adding...' : 'Add Bank'}
          </button>
        </form>
      </div>
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
        <BankAccountsCard adminKey={adminKey} />
      </div>
    </div>
  );
}
