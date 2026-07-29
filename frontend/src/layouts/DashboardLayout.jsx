import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import LanguageSwitch from '../components/LanguageSwitch';
import NotificationBell from '../components/NotificationBell';
import './DashboardLayout.css';

// `permission: null` means everyone signed in can see it. Anything else is
// hidden unless the user's effective permissions include it, so a cashier
// isn't shown links that would only 403 on them.
const NAV_ITEMS = [
  { to: '/dashboard', key: 'dashboard', end: true, permission: null, prefetch: () => import('../pages/dashboard/DashboardHome') },
  { to: '/dashboard/pos', key: 'pos', permission: null, prefetch: () => import('../pages/dashboard/POS') },
  { to: '/dashboard/inventory', key: 'inventory', permission: null, prefetch: () => import('../pages/dashboard/Inventory') },
  { to: '/dashboard/categories', key: 'categories', permission: null, prefetch: () => import('../pages/dashboard/Categories') },
  { to: '/dashboard/sales', key: 'sales', permission: null, prefetch: () => import('../pages/dashboard/Sales') },
  { to: '/dashboard/purchases', key: 'purchases', permission: 'purchase:manage', prefetch: () => import('../pages/dashboard/Purchases') },
  { to: '/dashboard/suppliers', key: 'suppliers', permission: 'supplier:manage', prefetch: () => import('../pages/dashboard/Suppliers') },
  { to: '/dashboard/customers', key: 'customers', permission: null, prefetch: () => import('../pages/dashboard/Customers') },
  { to: '/dashboard/expenses', key: 'expenses', permission: 'expense:manage', prefetch: () => import('../pages/dashboard/Expenses') },
  { to: '/dashboard/reports', key: 'reports', permission: 'report:view', prefetch: () => import('../pages/dashboard/Reports') },
  { to: '/dashboard/staff', key: 'staff', permission: 'staff:manage', prefetch: () => import('../pages/dashboard/Staff') },
  { to: '/dashboard/settings', key: 'settings', permission: 'shop:settings', prefetch: () => import('../pages/dashboard/Settings') },
];

export default function DashboardLayout() {
  const { user, shop, logout, can } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    );
    if (activeItem) {
      document.title = `${t(`nav.${activeItem.key}`)} | Retail Pro`;
    } else if (location.pathname.includes('/profile')) {
      document.title = `Profile | Retail Pro`;
    } else {
      document.title = `Retail Pro`;
    }
  }, [location.pathname, t]);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-brand">RetailPro</div>
        <nav>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="dash-nav-link"
              onMouseEnter={() => item.prefetch && item.prefetch()}
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <span className="dash-shop-name">{shop?.name || 'My Shop'}</span>
          <div className="dash-user">
            <NotificationBell />
            <LanguageSwitch />
            <Link to="/dashboard/profile" className="dash-user-link">
              {user?.name} ({user?.role})
            </Link>
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
