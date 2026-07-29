import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { getShopSettings, updateShopSettings, requestSubscriptionUpgrade } from '../../api/shop';
import { sendLowStockAlert } from '../../api/notifications';
import { useAuth } from '../../context/useAuth';
import LanguageSwitch from '../../components/LanguageSwitch';
import './Inventory.css';

const BUSINESS_TYPES = ['kiryana', 'general', 'medical', 'wholesale', 'other'];

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  // Subscription upgrade form state
  const [planRequested, setPlanRequested] = useState('pro');
  const [paymentChannel, setPaymentChannel] = useState('JazzCash');
  const [transactionId, setTransactionId] = useState('');
  const [submittingTrx, setSubmittingTrx] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    getShopSettings()
      .then((res) => setForm(res.data))
      .catch(() => toast.error('Failed to load shop settings'));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateShopSettings({
        name: form.name,
        businessType: form.businessType,
        ownerName: form.ownerName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        whatsappNumber: form.whatsappNumber,
        lowStockThreshold: Number(form.lowStockThreshold),
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setSendingAlert(true);
    try {
      const res = await sendLowStockAlert();
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank');
      }
      toast.success('Low stock alert generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send alert');
    } finally {
      setSendingAlert(false);
    }
  };

  const handleUpgradeSubmit = async (e) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      toast.error('Please enter your Transaction TRX ID or Reference Number');
      return;
    }
    setSubmittingTrx(true);
    try {
      const res = await requestSubscriptionUpgrade({ planRequested, paymentChannel, transactionId: transactionId.trim() });
      toast.success('Upgrade request submitted!');
      setWhatsappUrl(res.whatsappUrl || '');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit upgrade request');
    } finally {
      setSubmittingTrx(false);
    }
  };

  if (!form) return <div className="page-loader">Loading settings...</div>;

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* Subscription & Billing Card */}
        <div className="table-wrap" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="chart-title" style={{ margin: 0 }}>Subscription & Billing</h2>
            <span className={form.subscriptionStatus === 'active' ? 'badge badge-ok' : 'badge badge-warning'}>
              {(form.subscriptionPlan || 'basic').toUpperCase()} — {form.subscriptionStatus || 'Trial'}
            </span>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#1e293b' }}>💳 How to Pay & Upgrade (Pakistan Local Payment Accounts)</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Send your monthly subscription fee to any of the official accounts below, then enter your Transaction TRX ID to activate:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                <strong style={{ color: '#15803d' }}>🟢 JazzCash / EasyPaisa</strong>
                <div>Account Title: <strong>Abdullah Saleem</strong></div>
                <div>Account Number: <strong>03056779779</strong></div>
              </div>
              <div style={{ background: '#fff', padding: '0.75rem', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                <strong style={{ color: '#1e40af' }}>🏦 Bank Transfer (Meezan / HBL)</strong>
                <div>Account Title: <strong>RetailPro Software</strong></div>
                <div>IBAN: <strong>PK89MEZN0001092837492019</strong></div>
              </div>
            </div>
          </div>

          {isOwner && (
            <form onSubmit={handleUpgradeSubmit} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#0f172a' }}>Submit Payment & Request Upgrade</h4>
              <div className="form-row">
                <div className="form-field">
                  <label>Select Plan</label>
                  <select value={planRequested} onChange={(e) => setPlanRequested(e.target.value)}>
                    <option value="basic">Basic Plan — Rs 1,500 / month</option>
                    <option value="pro">Pro Plan — Rs 3,500 / month (Recommended)</option>
                    <option value="enterprise">Enterprise Plan — Rs 7,500 / month</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Payment Channel</label>
                  <select value={paymentChannel} onChange={(e) => setPaymentChannel(e.target.value)}>
                    <option value="JazzCash">JazzCash</option>
                    <option value="EasyPaisa">EasyPaisa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Transaction TRX ID / Reference #</label>
                  <input
                    placeholder="e.g. 092837419238"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary btn-inline" disabled={submittingTrx}>
                  {submittingTrx ? 'Submitting...' : 'Submit Payment Verification'}
                </button>
                {whatsappUrl && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ background: '#25d366', color: '#fff', border: 'none' }}
                    onClick={() => window.open(whatsappUrl, '_blank')}
                  >
                    📲 Send Payment Screenshot via WhatsApp
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="table-wrap" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <h2 className="chart-title">Language</h2>
          <p className="report-period">Switch the interface between English and Urdu. Urdu uses right-to-left layout.</p>
          <LanguageSwitch />
        </div>

        <form className="table-wrap" style={{ padding: '1.5rem' }} onSubmit={handleSubmit}>
          <h2 className="chart-title">Shop Profile</h2>

          <div className="form-row">
            <div className="form-field">
              <label>Shop Name</label>
              <input name="name" value={form.name || ''} onChange={handleChange} disabled={!isOwner} required />
            </div>
            <div className="form-field">
              <label>Business Type</label>
              <select name="businessType" value={form.businessType || 'general'} onChange={handleChange} disabled={!isOwner}>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '0.85rem' }}>
            <div className="form-field">
              <label>Owner Name</label>
              <input name="ownerName" value={form.ownerName || ''} onChange={handleChange} disabled={!isOwner} required />
            </div>
            <div className="form-field">
              <label>Phone</label>
              <input name="phone" value={form.phone || ''} onChange={handleChange} disabled={!isOwner} required />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '0.85rem' }}>
            <div className="form-field">
              <label>City</label>
              <input name="city" value={form.city || ''} onChange={handleChange} disabled={!isOwner} />
            </div>
            <div className="form-field">
              <label>Address</label>
              <input name="address" value={form.address || ''} onChange={handleChange} disabled={!isOwner} />
            </div>
          </div>

          <h2 className="chart-title" style={{ marginTop: '1.75rem' }}>WhatsApp Alerts</h2>
          <div className="form-row">
            <div className="form-field">
              <label>WhatsApp Number</label>
              <input
                name="whatsappNumber"
                value={form.whatsappNumber || ''}
                onChange={handleChange}
                placeholder="923001234567"
                disabled={!isOwner}
              />
            </div>
            <div className="form-field">
              <label>Default Low Stock Threshold</label>
              <input
                name="lowStockThreshold"
                type="number"
                min="0"
                value={form.lowStockThreshold ?? 10}
                onChange={handleChange}
                disabled={!isOwner}
              />
            </div>
          </div>
          <p className="report-period" style={{ marginTop: '0.6rem' }}>
            Daily sales reports go out at 9:00 PM PKT, low stock alerts at 8:00 AM PKT, and a profit summary
            every Sunday evening.
          </p>

          {isOwner && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-primary btn-inline" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 'none', padding: '0.55rem 1.1rem' }} onClick={handleTestAlert} disabled={sendingAlert}>
                {sendingAlert ? 'Sending...' : 'Send Low Stock Alert Now'}
              </button>
            </div>
          )}

          {!isOwner && (
            <p className="report-period" style={{ marginTop: '1rem' }}>
              Only the shop owner can change these settings.
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
