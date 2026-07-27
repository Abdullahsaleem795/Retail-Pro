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
  city: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
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
        style={{ maxWidth: 480 }}
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
