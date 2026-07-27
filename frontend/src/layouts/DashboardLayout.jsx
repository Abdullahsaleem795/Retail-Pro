import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './DashboardLayout.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/dashboard/pos', label: 'POS' },
  { to: '/dashboard/inventory', label: 'Inventory' },
  { to: '/dashboard/sales', label: 'Sales' },
  { to: '/dashboard/purchases', label: 'Purchases' },
  { to: '/dashboard/suppliers', label: 'Suppliers' },
  { to: '/dashboard/customers', label: 'Customers' },
  { to: '/dashboard/expenses', label: 'Expenses' },
  { to: '/dashboard/reports', label: 'Reports' },
  { to: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout() {
  const { user, shop, logout } = useAuth();

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">RetailPro</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="dash-nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-shop-name">{shop?.name || 'My Shop'}</span>
          <div className="dash-user">
            <span>{user?.name} ({user?.role})</span>
            <button onClick={logout} className="btn-logout">Logout</button>
          </div>
        </header>
        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
