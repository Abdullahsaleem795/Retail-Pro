import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import LanguageSwitch from '../components/LanguageSwitch';
import './DashboardLayout.css';

const NAV_ITEMS = [
  { to: '/dashboard', key: 'dashboard', end: true },
  { to: '/dashboard/pos', key: 'pos' },
  { to: '/dashboard/inventory', key: 'inventory' },
  { to: '/dashboard/sales', key: 'sales' },
  { to: '/dashboard/purchases', key: 'purchases' },
  { to: '/dashboard/suppliers', key: 'suppliers' },
  { to: '/dashboard/customers', key: 'customers' },
  { to: '/dashboard/expenses', key: 'expenses' },
  { to: '/dashboard/reports', key: 'reports' },
  { to: '/dashboard/settings', key: 'settings' },
];

export default function DashboardLayout() {
  const { user, shop, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">RetailPro</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="dash-nav-link">
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-shop-name">{shop?.name || 'My Shop'}</span>
          <div className="dash-user">
            <LanguageSwitch />
            <span>{user?.name} ({user?.role})</span>
            <button onClick={logout} className="btn-logout">{t('common.logout')}</button>
          </div>
        </header>
        <main className="dash-content">
          {/* Suspense sits here rather than around the whole layout so the
              sidebar and topbar stay put while a lazy page chunk loads. */}
          <Suspense fallback={<div className="page-loader">{t('common.loading')}</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
