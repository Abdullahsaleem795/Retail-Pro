import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/useAuth';
import './Auth.css';

const initialForm = {
  shopName: '',
  businessType: 'general',
  ownerName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  city: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const getPasswordStrength = (pass) => {
    if (!pass) return null;
    if (pass.length < 6) return { label: 'Too short', color: '#ef4444' };
    if (pass.length >= 8 && /[A-Z]/.test(pass) && /[0-9]/.test(pass)) return { label: 'Strong', color: '#22c55e' };
    return { label: 'Medium', color: '#eab308' };
  };

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register({
        shopName: form.shopName,
        businessType: form.businessType,
        ownerName: form.ownerName,
        phone: form.phone,
        email: form.email,
        password: form.password,
        city: form.city,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ maxWidth: 520 }}
      >
        <div className="auth-brand">RetailPro</div>
        <div className="auth-subtitle">Set up your shop in under a minute</div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="shopName">Shop Name</label>
              <input id="shopName" name="shopName" value={form.shopName} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label htmlFor="businessType">Business Type</label>
              <select id="businessType" name="businessType" value={form.businessType} onChange={handleChange}>
                <option value="kiryana">Kiryana Store</option>
                <option value="general">General Store</option>
                <option value="medical">Medical Store</option>
                <option value="wholesale">Wholesale Shop</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="ownerName">Owner Name</label>
            <input id="ownerName" name="ownerName" value={form.ownerName} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" name="phone" value={form.phone} onChange={handleChange} required />
            </div>
            <div className="form-field">
              <label htmlFor="city">City</label>
              <input id="city" name="city" value={form.city} onChange={handleChange} />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={6}
                value={form.password}
                onChange={handleChange}
                required
              />
              {strength && (
                <span style={{ fontSize: '0.72rem', color: strength.color, marginTop: '2px', fontWeight: 600 }}>
                  Strength: {strength.label}
                </span>
              )}
            </div>
            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={6}
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating shop...' : 'Create Shop'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}
