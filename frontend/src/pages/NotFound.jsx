import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './auth/Auth.css';

export default function NotFound() {
  return (
    <div className="auth-shell">
      <motion.div
        className="auth-card"
        style={{ textAlign: 'center', maxWidth: 440, padding: '3rem 2rem' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div style={{ fontSize: '4rem', fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>404</div>
        <h2 style={{ fontSize: '1.25rem', color: '#f8fafc', margin: '0.75rem 0 0.5rem' }}>Page Not Found</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
          Return to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
