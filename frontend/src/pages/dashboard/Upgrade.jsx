import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { getShopSettings, requestSubscriptionUpgrade, getPaymentAccounts } from '../../api/shop';
import { useAuth } from '../../context/useAuth';
import PaymentMonogram from '../../components/PaymentMonogram';
import './Settings.css';

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

export default function Upgrade() {
  const { user } = useAuth();
  const [form, setForm] = useState(null);

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
      .catch(() => toast.error('Failed to load subscription status'));
    // Operator-owned accounts, editable from the platform admin console -
    // fetched rather than hardcoded so a number change doesn't need a
    // frontend code change + redeploy.
    getPaymentAccounts()
      .then((res) => setPaymentAccounts(res.data))
      .catch(() => {});
  }, []);

  // One flat list of everywhere the shop can send money. The account details
  // and the "which channel did you pay through?" choice used to be two
  // separate widgets showing the same accounts twice - this is the single
  // source both the cards and the submitted paymentChannel read from.
  const payMethods = useMemo(() => {
    if (!paymentAccounts) return [];
    const methods = [];

    if (paymentAccounts.jazzcashNumber) {
      methods.push({
        id: 'jazzcash',
        channel: 'JazzCash',
        name: 'JazzCash',
        kind: 'Mobile Wallet',
        accountTitle: paymentAccounts.jazzcashTitle,
        numberLabel: 'Account Number',
        number: paymentAccounts.jazzcashNumber,
      });
    }
    if (paymentAccounts.easypaisaNumber) {
      methods.push({
        id: 'easypaisa',
        channel: 'EasyPaisa',
        name: 'EasyPaisa',
        kind: 'Mobile Wallet',
        accountTitle: paymentAccounts.easypaisaTitle,
        numberLabel: 'Account Number',
        number: paymentAccounts.easypaisaNumber,
      });
    }
    (paymentAccounts.banks || []).forEach((bank) => {
      methods.push({
        id: bank._id,
        // Carries the bank name into the TRX reference, the admin email and
        // the WhatsApp ping, so whoever verifies knows which account to check.
        channel: `Bank Transfer - ${bank.bankName}`,
        name: bank.bankName,
        kind: 'Bank Transfer',
        accountTitle: bank.accountTitle,
        numberLabel: bank.iban ? 'IBAN' : 'Account Number',
        number: bank.iban || bank.accountNumber,
      });
    });

    return methods;
  }, [paymentAccounts]);

  // Keep the selection pointing at something that actually exists - the
  // default ('JazzCash') is a guess made before the accounts have loaded, and
  // the operator may not even offer it.
  useEffect(() => {
    if (payMethods.length && !payMethods.some((m) => m.channel === paymentChannel)) {
      setPaymentChannel(payMethods[0].channel);
    }
  }, [payMethods, paymentChannel]);

  // Grouped by kind so the card itself doesn't have to repeat "BANK TRANSFER"
  // on every row - one heading says it once, and the bank name gets the full
  // width of the card instead of being truncated by a redundant tag.
  const payGroups = useMemo(() => {
    const order = ['Mobile Wallet', 'Bank Transfer'];
    return order
      .map((kind) => ({
        kind,
        label: kind === 'Mobile Wallet' ? 'Mobile Wallets' : 'Bank Transfer',
        methods: payMethods.filter((m) => m.kind === kind),
      }))
      .filter((g) => g.methods.length > 0);
  }, [payMethods]);

  const selectedMethod = payMethods.find((m) => m.channel === paymentChannel) || null;

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy - please select and copy manually');
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

  if (!form) return <div className="page-loader">Loading subscription...</div>;

  return (
    <div>
      <h1 className="page-title">Upgrade Plan</h1>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
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
            <div className="payment-box-head">
              <h3 className="payment-box-title">Choose how you&apos;ll pay</h3>
              <p className="payment-box-sub">
                Transfer the plan fee to one of these accounts, select it below, then enter your transaction ID.
              </p>
            </div>

            {payMethods.length > 0 ? (
              <div role="radiogroup" aria-label="Payment account">
                {payGroups.map((group) => (
                  <div className="pay-group" key={group.kind}>
                    <span className="pay-group-label">{group.label}</span>
                    <div className="pay-methods">
                      {group.methods.map((method) => {
                        const selected = paymentChannel === method.channel;
                        return (
                          <label className={`pay-method ${selected ? 'is-selected' : ''}`} key={method.id}>
                            <input
                              type="radio"
                              className="pay-method-input"
                              name="paymentMethod"
                              value={method.channel}
                              checked={selected}
                              onChange={() => setPaymentChannel(method.channel)}
                            />
                            <PaymentMonogram name={method.name} size={44} className="pay-method-mark" />
                            <span className="pay-method-body">
                              <span className="pay-method-name">{method.name}</span>
                              <span className="pay-method-title">{method.accountTitle}</span>
                              <span className="pay-method-number-row">
                                <span className="pay-method-number">{method.number}</span>
                                <button
                                  type="button"
                                  className="pay-copy"
                                  // preventDefault stops the surrounding <label>
                                  // from also toggling the radio on a copy click.
                                  onClick={(e) => { e.preventDefault(); copyToClipboard(method.number, method.numberLabel); }}
                                  title={`Copy ${method.numberLabel}`}
                                >
                                  Copy
                                </button>
                              </span>
                            </span>
                            <span className="pay-method-check" aria-hidden="true" />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="payment-empty">
                {paymentAccounts
                  ? 'No payment accounts configured yet — contact support to arrange payment.'
                  : 'Loading payment accounts...'}
              </p>
            )}
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
                  <label>Paying Through</label>
                  {/* Mirrors the card selected above rather than repeating the
                      list - the picker IS the input, this is just confirmation
                      of what's about to be submitted. */}
                  <div className="paying-through">
                    {selectedMethod ? (
                      <>
                        <PaymentMonogram name={selectedMethod.name} size={28} className="pay-method-mark-sm" />
                        <span className="paying-through-name">{selectedMethod.name}</span>
                      </>
                    ) : (
                      <span className="paying-through-empty">Select an account above</span>
                    )}
                  </div>
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
      </motion.div>
    </div>
  );
}
