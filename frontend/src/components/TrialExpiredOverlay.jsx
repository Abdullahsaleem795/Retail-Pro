import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '../context/useAuth';
import './TrialExpiredOverlay.css';

// Hard lockout, by explicit choice - no close button, no click-outside-to-
// dismiss, no Escape handler. The only ways out are upgrading or logging
// out. Rendered from DashboardLayout whenever shop.subscriptionStatus is
// 'expired' and the current route isn't the Upgrade page itself (that page
// needs to stay usable so there's an actual way to resolve this).
export default function TrialExpiredOverlay() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="trial-lock-overlay" role="alertdialog" aria-modal="true" aria-labelledby="trial-lock-title">
      <div className="trial-lock-card">
        <span className="trial-lock-icon" aria-hidden="true"><FiLock size={22} /></span>
        <h2 id="trial-lock-title">Your free trial has ended.</h2>
        <p>Kindly upgrade your plan to keep using RetailPro.</p>
        <button className="btn-primary trial-lock-cta" onClick={() => navigate('/dashboard/upgrade')}>
          Upgrade Now
        </button>
        <button className="trial-lock-logout" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
