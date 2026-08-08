import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/useAuth';
import { getRememberedUsers, forgetUser } from '../../utils/quickSwitch';
import './Auth.css';

// Strips parenthetical asides first - staff created via the seed script (or
// an owner typing "Kashif (Cashier)" as a display name to tell two Kashifs
// apart) would otherwise turn a stray "(" into a real initial.
const initials = (name = '') =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier' };

function PinPad({ account, onBack, onSubmitted }) {
  const { pinLogin } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (value) => {
    if (value.length < 4 || loading) return;
    setError('');
    setLoading(true);
    try {
      await pinLogin(account.id, value);
      onSubmitted?.();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Functional update - pushDigit fires from keypad clicks that can queue up
  // faster than a render cycle (rapid taps on a touchscreen till), so reading
  // `pin` from closure here would silently drop digits under fast input.
  const pushDigit = (d) => {
    if (loading) return;
    setPin((prev) => (prev.length >= 6 ? prev : prev + d));
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  // Auto-submit once the 6th digit lands. Driven by an effect (not inline in
  // pushDigit) so it always sees the settled state, not a stale value from
  // the same tick as several rapid taps.
  useEffect(() => {
    if (pin.length === 6) submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div>
      <button type="button" className="pin-back" onClick={onBack}>← Not {account.name.split(' ')[0]}?</button>

      <div className="pin-identity">
        <div className="pin-avatar pin-avatar-lg">{initials(account.name)}</div>
        <div>
          <div className="pin-identity-name">{account.name}</div>
          <div className="pin-identity-role">{ROLE_LABELS[account.role] || account.role}</div>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <input
        type="password"
        inputMode="numeric"
        autoFocus
        className="pin-hidden-input"
        value={pin}
        maxLength={6}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
          setPin(digits);
          if (digits.length === 6) submit(digits);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(pin);
        }}
      />

      <div className="pin-dots">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`pin-dot ${i < pin.length ? 'is-filled' : ''}`} />
        ))}
      </div>

      <div className="pin-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button type="button" key={d} onClick={() => pushDigit(d)} disabled={loading}>{d}</button>
        ))}
        <button type="button" className="pin-key-ghost" onClick={() => setPin('')} disabled={loading}>Clear</button>
        <button type="button" onClick={() => pushDigit('0')} disabled={loading}>0</button>
        <button type="button" className="pin-key-ghost" onClick={backspace} disabled={loading}>⌫</button>
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: '0.75rem' }}
        onClick={() => submit(pin)}
        disabled={pin.length < 4 || loading}
      >
        {loading ? 'Checking...' : 'Unlock'}
      </button>
    </div>
  );
}

function QuickSwitch({ accounts, onPick, onForget, onUseDifferentAccount }) {
  return (
    <div>
      <div className="pin-tile-grid">
        {accounts.map((acc) => (
          <div key={acc.id} className="pin-tile" onClick={() => onPick(acc)}>
            <button
              type="button"
              className="pin-tile-remove"
              title="Forget this account on this device"
              onClick={(e) => { e.stopPropagation(); onForget(acc.id); }}
            >
              ×
            </button>
            <div className="pin-avatar">{initials(acc.name)}</div>
            <div className="pin-tile-name">{acc.name}</div>
            <div className="pin-tile-role">{ROLE_LABELS[acc.role] || acc.role}</div>
            {acc.shopName && <div className="pin-tile-shop">{acc.shopName}</div>}
          </div>
        ))}
      </div>
      <button type="button" className="auth-switch-link" onClick={onUseDifferentAccount}>
        Use a different account
      </button>
    </div>
  );
}

function PasswordForm({ prefillEmail, onSuccess }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: prefillEmail || '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      onSuccess?.();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function Login() {
  const [accounts, setAccounts] = useState([]);
  const [view, setView] = useState('loading'); // loading | quick-switch | pin | password
  const [activeAccount, setActiveAccount] = useState(null);

  useEffect(() => {
    const remembered = getRememberedUsers();
    setAccounts(remembered);
    setView(remembered.length > 0 ? 'quick-switch' : 'password');
  }, []);

  const handleForget = (id) => {
    forgetUser(id);
    const next = getRememberedUsers();
    setAccounts(next);
    if (next.length === 0) setView('password');
  };

  return (
    <div className="auth-shell">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={view === 'quick-switch' && accounts.length > 2 ? { maxWidth: 480 } : undefined}
      >
        <div className="auth-brand">RetailPro</div>
        <div className="auth-subtitle">
          {view === 'quick-switch' && 'Who is this?'}
          {view === 'pin' && 'Enter your PIN'}
          {view === 'password' && 'Sign in to manage your shop'}
        </div>

        <AnimatePresence mode="wait">
          {view === 'quick-switch' && (
            <motion.div key="qs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <QuickSwitch
                accounts={accounts}
                onPick={(acc) => { setActiveAccount(acc); setView('pin'); }}
                onForget={handleForget}
                onUseDifferentAccount={() => setView('password')}
              />
            </motion.div>
          )}

          {view === 'pin' && activeAccount && (
            <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <PinPad
                account={activeAccount}
                onBack={() => setView(accounts.length > 0 ? 'quick-switch' : 'password')}
              />
            </motion.div>
          )}

          {view === 'password' && (
            <motion.div key="pw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <PasswordForm prefillEmail={activeAccount?.email} />
              {accounts.length > 0 && (
                <button type="button" className="auth-switch-link" onClick={() => setView('quick-switch')}>
                  ← Back to account list
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="auth-switch">
          New shop? <Link to="/register">Create an account</Link>
        </div>
      </motion.div>
    </div>
  );
}
