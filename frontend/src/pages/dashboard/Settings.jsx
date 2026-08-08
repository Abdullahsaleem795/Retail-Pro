import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { getShopSettings, updateShopSettings, requestSubscriptionUpgrade, getPaymentAccounts } from '../../api/shop';
import { sendLowStockAlert } from '../../api/notifications';
import { useAuth } from '../../context/useAuth';
import LanguageSwitch from '../../components/LanguageSwitch';
import './Inventory.css';
import './Settings.css';

const BUSINESS_TYPES = ['kiryana', 'general', 'medical', 'wholesale', 'other'];

const PLAN_DETAILS = {
  basic: {
    nameEn: 'Basic Plan',
    nameUr: 'بنیادی پلان',
    price: 'Rs 1,500 / month',
    taglineEn: 'Essential POS & Inventory features for small single-counter stores.',
    taglineUr: 'چھوٹے اسٹورز کے لیے بنیادی پی او ایس اور انوینٹری کی خصوصیات۔',
    benefitsEn: [
      '1 POS Terminal & Billing Counter',
      'Up to 500 Inventory Products',
      'Up to 2 Staff Accounts (Cashiers)',
      'Daily Sales & Expense Tracking Reports',
      'Thermal Receipt Printing & Search History',
      'Standard In-App Customer Management',
    ],
    benefitsUr: [
      '1 پی او ایس ٹرمینل اور بلنگ کاؤنٹر',
      '500 تک سامان/انوینٹری کی پروڈکٹس',
      '2 تک اسٹاف اکاؤنٹس (کیشیئر)',
      'روزانہ کی فروخت اور اخراجات کی رپورٹ',
      'تھرمل رسید پرنٹنگ اور ہسٹری سرچ',
      'عام ان اپپ کسٹمر مینجمنٹ',
    ],
  },
  pro: {
    nameEn: 'Pro Plan',
    nameUr: 'پرو پلان',
    price: 'Rs 3,500 / month',
    taglineEn: 'Full automation, WhatsApp integration & BI analytics for growing stores.',
    taglineUr: 'بڑھتے ہوئے کاروبار کے لیے مکمل واٹس ایپ آٹومیشن اور ایڈوانسڈ رپورٹس۔',
    benefitsEn: [
      'Everything in Basic, plus:',
      'Automated WhatsApp Low Stock Alerts & Supplier Reorder Drafts',
      'Unlimited Staff Accounts (Managers & Cashiers with Custom Permissions)',
      'Advanced BI Analytics (Dead Stock Finder, Margin Warnings & Profit Insights)',
      'Custom Store Logo & Thermal Receipt Header Customization',
      'Priority In-App & Email Technical Support',
    ],
    benefitsUr: [
      'بنیادی پلان کی تمام خصوصیات شامل ہیں، مزید:',
      'واٹس ایپ پر آٹو لو اسٹاک الرٹس اور سپلائر آرڈر ڈرافٹس',
      'لامحدود اسٹاف اکاؤنٹس (منیجر اور کیشیئر کسٹم پرمیشنز کے ساتھ)',
      'ایڈوانسڈ بزنس رپورٹس (ڈیڈ اسٹاک، منافع اور نقصان وارننگ)',
      'کسٹم اسٹور لوگو اور رسید پرنٹنگ ڈیزائننگ',
      'ترجیحی واٹس ایپ اور ای میل تکنیکی مدد',
    ],
  },
  enterprise: {
    nameEn: 'Enterprise Plan',
    nameUr: 'انٹرپرائز پلان',
    price: 'Rs 7,500 / month',
    taglineEn: 'Unlimited power for multi-branch retail chains & large supermarkets.',
    taglineUr: 'ملٹی برانچ اسٹورز اور بڑے سپرمارکیٹس کے لیے لا محدود خصوصیات۔',
    benefitsEn: [
      'Everything in Pro, plus:',
      'Multi-Branch & Multi-Counter Inventory Synchronization',
      '24/7 Dedicated Priority Phone & WhatsApp Account Manager Support',
      'Custom ERP & Accounting Integration',
      'Automated Hourly Offsite Secure Database Backups',
      'Custom Feature Requests & Onsite Staff Setup/Training',
    ],
    benefitsUr: [
      'پرو پلان کی تمام خصوصیات شامل ہیں، مزید:',
      'ملٹی برانچ اور ملٹی کاؤنٹر انوینٹری کی ہم آہنگی (سنک)',
      '24/7 خصوصی فون اور واٹس ایپ اکاؤنٹ منیجر سپورٹ',
      'کسٹم ای آر پی اور اکاؤنٹنگ انٹیگریشن',
      'خودکار گھنٹہ وار ڈیٹا بیس کا محفوظ بیک اپ',
      'خصوصی فیچرز کی تیاری اور اسٹاف کی عملی تربیت',
    ],
  },
};

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);

  // Subscription upgrade form state
  const [planRequested, setPlanRequested] = useState('pro');
  const [planLang, setPlanLang] = useState('en'); // 'en' | 'ur'
  const [paymentChannel, setPaymentChannel] = useState('JazzCash');
  const [transactionId, setTransactionId] = useState('');
  const [submittingTrx, setSubmittingTrx] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [paymentAccounts, setPaymentAccounts] = useState(null);

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    getShopSettings()
      .then((res) => setForm(res.data))
      .catch(() => toast.error('Failed to load shop settings'));
    // Operator-owned accounts, editable from the platform admin console -
    // fetched rather than hardcoded so a number change doesn't need a
    // frontend code change + redeploy.
    getPaymentAccounts()
      .then((res) => setPaymentAccounts(res.data))
      .catch(() => {});
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
          <div className="sub-card-head">
            <h2 className="chart-title" style={{ margin: 0 }}>Subscription & Billing</h2>
            <span className={form.subscriptionStatus === 'active' ? 'badge badge-ok' : 'badge badge-warning'}>
              {(form.subscriptionPlan || 'basic').toUpperCase()} — {form.subscriptionStatus || 'Trial'}
            </span>
          </div>

          {/* Plan Comparison & Benefits Cards */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="sub-section-label">Select a plan</p>
            <div className="plan-grid">
              <div
                className={`plan-card ${planRequested === 'basic' ? 'is-selected' : ''}`}
                onClick={() => setPlanRequested('basic')}
              >
                <div className="plan-card-head">
                  <h4 className="plan-card-name">Basic</h4>
                  <span className="plan-card-price">Rs 1,500 / mo</span>
                </div>
                <p className="plan-card-tagline">Perfect for single-counter stores getting started.</p>
                <ul className="plan-card-list">
                  <li>1 POS Terminal & Checkout Counter</li>
                  <li>Up to 500 Inventory Items</li>
                  <li>Up to 2 Staff Accounts (Cashiers)</li>
                  <li>Daily Sales & Expense Tracking</li>
                  <li>Thermal Receipt Printing</li>
                </ul>
              </div>

              <div
                className={`plan-card ${planRequested === 'pro' ? 'is-selected' : ''}`}
                onClick={() => setPlanRequested('pro')}
              >
                <span className="plan-badge-recommended">Recommended</span>
                <div className="plan-card-head">
                  <h4 className="plan-card-name">Pro</h4>
                  <span className="plan-card-price">Rs 3,500 / mo</span>
                </div>
                <p className="plan-card-tagline">Full automation & growth for busy retail stores.</p>
                <ul className="plan-card-list">
                  <li><strong>Everything in Basic, plus:</strong></li>
                  <li>Automated WhatsApp Supplier Orders & Low Stock Alerts</li>
                  <li>Unlimited Staff Accounts (Managers & Cashiers)</li>
                  <li>Advanced BI Analytics (Dead Stock & Margin Warnings)</li>
                </ul>
              </div>

              <div
                className={`plan-card ${planRequested === 'enterprise' ? 'is-selected' : ''}`}
                onClick={() => setPlanRequested('enterprise')}
              >
                <div className="plan-card-head">
                  <h4 className="plan-card-name">Enterprise</h4>
                  <span className="plan-card-price">Rs 7,500 / mo</span>
                </div>
                <p className="plan-card-tagline">For multi-branch chains & high-volume marts.</p>
                <ul className="plan-card-list">
                  <li><strong>Everything in Pro, plus:</strong></li>
                  <li>Multi-Branch & Multi-Counter Sync</li>
                  <li>Dedicated Priority Phone & WhatsApp Support</li>
                  <li>Custom ERP & Accounting Integration</li>
                  <li>Automated Hourly Offsite Database Backups</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="payment-box">
            <h3 className="sub-section-label" style={{ marginBottom: '0.4rem' }}>How to pay & upgrade (Pakistan local payment accounts)</h3>
            <p>
              Send your monthly subscription fee to one of the accounts below, then enter your transaction ID to request activation:
            </p>
            <div className="payment-grid">
              {paymentAccounts?.jazzcashNumber && (
                <div className="payment-account">
                  <span className="payment-account-title">JazzCash</span>
                  <div>Account Title: <strong>{paymentAccounts.jazzcashTitle}</strong></div>
                  <div>Account Number: <strong>{paymentAccounts.jazzcashNumber}</strong></div>
                </div>
              )}
              {paymentAccounts?.easypaisaNumber && (
                <div className="payment-account">
                  <span className="payment-account-title">EasyPaisa</span>
                  <div>Account Title: <strong>{paymentAccounts.easypaisaTitle}</strong></div>
                  <div>Account Number: <strong>{paymentAccounts.easypaisaNumber}</strong></div>
                </div>
              )}
              {paymentAccounts?.bankIban && (
                <div className="payment-account">
                  <span className="payment-account-title">Bank Transfer{paymentAccounts.bankName ? ` (${paymentAccounts.bankName})` : ''}</span>
                  <div>Account Title: <strong>{paymentAccounts.bankTitle}</strong></div>
                  <div>IBAN: <strong>{paymentAccounts.bankIban}</strong></div>
                </div>
              )}
              {paymentAccounts && !paymentAccounts.jazzcashNumber && !paymentAccounts.easypaisaNumber && !paymentAccounts.bankIban && (
                <p style={{ margin: 0, gridColumn: '1 / -1' }}>No payment accounts configured yet - contact the shop to arrange payment.</p>
              )}
            </div>
          </div>

          {isOwner && (
            <form onSubmit={handleUpgradeSubmit} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
              <div className="sub-card-head" style={{ marginBottom: '1.1rem' }}>
                <h4 style={{ margin: 0, fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)' }}>
                  Submit payment & request upgrade
                </h4>
                <div className="lang-toggle">
                  <button
                    type="button"
                    className={planLang === 'en' ? 'is-active' : ''}
                    onClick={() => setPlanLang('en')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={planLang === 'ur' ? 'is-active' : ''}
                    onClick={() => setPlanLang('ur')}
                  >
                    اردو
                  </button>
                </div>
              </div>

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

              {/* Dynamic Selected Plan Benefits Box */}
              {PLAN_DETAILS[planRequested] && (
                <div className="benefits-box" dir={planLang === 'ur' ? 'rtl' : 'ltr'}>
                  <div className="benefits-box-head">
                    <span className="benefits-box-plan">
                      {planLang === 'ur' ? PLAN_DETAILS[planRequested].nameUr : PLAN_DETAILS[planRequested].nameEn} — {PLAN_DETAILS[planRequested].price}
                    </span>
                    <span className="benefits-box-kicker">
                      {planLang === 'ur' ? 'پلان کی خصوصیات' : 'Included Benefits'}
                    </span>
                  </div>
                  <p className="benefits-box-tagline">
                    {planLang === 'ur' ? PLAN_DETAILS[planRequested].taglineUr : PLAN_DETAILS[planRequested].taglineEn}
                  </p>
                  <ul className="benefits-box-list">
                    {(planLang === 'ur' ? PLAN_DETAILS[planRequested].benefitsUr : PLAN_DETAILS[planRequested].benefitsEn).map((b, idx) => (
                      <li key={idx}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary btn-inline" disabled={submittingTrx}>
                  {submittingTrx ? 'Submitting...' : 'Submit Payment Verification'}
                </button>
                {whatsappUrl && (
                  <button
                    type="button"
                    className="btn-secondary btn-whatsapp"
                    onClick={() => window.open(whatsappUrl, '_blank')}
                  >
                    Send Payment Screenshot via WhatsApp
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
