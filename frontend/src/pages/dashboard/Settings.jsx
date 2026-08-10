import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { getShopSettings, updateShopSettings } from '../../api/shop';
import { sendLowStockAlert } from '../../api/notifications';
import { useAuth } from '../../context/useAuth';
import LanguageSwitch from '../../components/LanguageSwitch';
import './Inventory.css';
import './Settings.css';

const BUSINESS_TYPES = ['kiryana', 'general', 'medical', 'wholesale', 'other'];

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

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
      if (res.deliveryStatus === 'sent') {
        toast.success('Low stock alert sent to your WhatsApp');
      } else {
        if (res.whatsappUrl) {
          window.open(res.whatsappUrl, '_blank');
        }
        toast.success('Low stock alert generated');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send alert');
    } finally {
      setSendingAlert(false);
    }
  };

  if (!form) return <div className="page-loader">Loading settings...</div>;

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
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
