import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiMenu, FiHome, FiShoppingCart, FiBox, FiAlertTriangle, FiTag, FiTrendingUp, FiTruck,
  FiUsers, FiUser, FiDollarSign, FiBarChart2, FiGitBranch, FiUserCheck, FiSettings,
  FiSearch, FiChevronDown, FiLogOut, FiPackage, FiCreditCard,
} from 'react-icons/fi';
import { useAuth } from '../context/useAuth';
import { listProducts } from '../api/products';
import LanguageSwitch from '../components/LanguageSwitch';
import NotificationBell from '../components/NotificationBell';
import { formatCurrency, capitalize } from '../utils/format';
import './DashboardLayout.css';

// `permission: null` means everyone signed in can see it. Anything else is
// hidden unless the user's effective permissions include it, so a cashier
// isn't shown links that would only 403 on them.
const NAV_ITEMS = [
  { to: '/dashboard', key: 'dashboard', end: true, permission: null, icon: FiHome, prefetch: () => import('../pages/dashboard/DashboardHome'), api: '/api/reports/dashboard-overview' },
  { to: '/dashboard/pos', key: 'pos', permission: null, icon: FiShoppingCart, prefetch: () => import('../pages/dashboard/POS'), api: '/api/products?limit=50' },
  { to: '/dashboard/inventory', key: 'inventory', permission: null, icon: FiBox, prefetch: () => import('../pages/dashboard/Inventory'), api: '/api/products?limit=50' },
  { to: '/dashboard/expiry-alerts', key: 'expiryAlerts', permission: null, icon: FiAlertTriangle, prefetch: () => import('../pages/dashboard/ExpiryAlerts'), api: '/api/products/expiry-alerts' },
  { to: '/dashboard/categories', key: 'categories', permission: null, icon: FiTag, prefetch: () => import('../pages/dashboard/Categories'), api: '/api/categories' },
  { to: '/dashboard/sales', key: 'sales', permission: null, icon: FiTrendingUp, prefetch: () => import('../pages/dashboard/Sales'), api: '/api/sales?limit=50' },
  { to: '/dashboard/purchases', key: 'purchases', permission: 'purchase:manage', icon: FiTruck, prefetch: () => import('../pages/dashboard/Purchases'), api: '/api/purchases?limit=50' },
  { to: '/dashboard/suppliers', key: 'suppliers', permission: 'supplier:manage', icon: FiPackage, prefetch: () => import('../pages/dashboard/Suppliers'), api: '/api/suppliers' },
  { to: '/dashboard/customers', key: 'customers', permission: null, icon: FiUsers, prefetch: () => import('../pages/dashboard/Customers'), api: '/api/customers' },
  { to: '/dashboard/expenses', key: 'expenses', permission: 'expense:manage', icon: FiDollarSign, prefetch: () => import('../pages/dashboard/Expenses'), api: '/api/expenses?limit=50' },
  { to: '/dashboard/reports', key: 'reports', permission: 'report:view', icon: FiBarChart2, prefetch: () => import('../pages/dashboard/Reports'), api: '/api/reports/dashboard-overview' },
  { to: '/dashboard/branches', key: 'branches', permission: 'branch:manage', icon: FiGitBranch, prefetch: () => import('../pages/dashboard/Branches'), api: '/api/branches' },
  { to: '/dashboard/staff', key: 'staff', permission: 'staff:manage', icon: FiUserCheck, prefetch: () => import('../pages/dashboard/Staff') },
  // Same 'shop:settings' gate as before - that permission is owner-only (see
  // backend/src/config/permissions.js), matching exactly who could actually
  // submit an upgrade request when this lived inside Settings.
  { to: '/dashboard/upgrade', key: 'upgrade', permission: 'shop:settings', icon: FiCreditCard, prefetch: () => import('../pages/dashboard/Upgrade') },
  { to: '/dashboard/settings', key: 'settings', permission: 'shop:settings', icon: FiSettings, prefetch: () => import('../pages/dashboard/Settings') },
];

// A real product-name/SKU/barcode search (reuses the same `search` param
// Inventory/POS already query with) - not a decorative box that goes nowhere.
function TopbarSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await listProducts({ search: query.trim(), limit: 6 });
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="topbar-search" ref={wrapRef}>
      <FiSearch className="topbar-search-icon" />
      <input
        placeholder="Search products by name, SKU, or barcode..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim() && (
        <div className="topbar-search-results">
          {searching ? (
            <div className="topbar-search-empty">Searching...</div>
          ) : results.length === 0 ? (
            <div className="topbar-search-empty">No products match "{query.trim()}"</div>
          ) : (
            results.map((p) => (
              <Link
                key={p._id}
                to="/dashboard/inventory"
                className="topbar-search-result"
                onClick={() => setOpen(false)}
              >
                <span className="topbar-search-result-name">{p.name}</span>
                <span className="topbar-search-result-meta">
                  {p.sku} &middot; {formatCurrency(p.sellingPrice)} &middot; {p.stockQuantity} {p.unit}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu" ref={wrapRef}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="user-menu-avatar">{initials}</span>
        <FiChevronDown size={14} />
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-info">
            <span className="user-menu-name">{user?.name}</span>
            <span className="user-menu-role">{user?.role}</span>
          </div>
          <button className="user-menu-item" onClick={() => { setOpen(false); navigate('/dashboard/profile'); }}>
            <FiUser size={15} /> Profile
          </button>
          <button className="user-menu-item user-menu-item-danger" onClick={logout}>
            <FiLogOut size={15} /> {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const { shop, user, can } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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

  // Idle prefetching for ultra-fast instantaneous navigation
  useEffect(() => {
    const prefetchIdle = () => {
      NAV_ITEMS.slice(0, 5).forEach((item) => {
        if (item.prefetch) item.prefetch();
      });
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchIdle, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    } else {
      const timer = setTimeout(prefetchIdle, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  const handleHover = (item) => {
    if (item.prefetch) item.prefetch();
  };

  return (
    <div className={`dash-shell${collapsed ? ' dash-shell-collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-icon"><FiShoppingCart size={18} /></span>
          <span className="dash-brand-text">
            <span className="dash-brand-name" title={user?.name}>{user?.name || 'User'}</span>
            <span className="dash-brand-sub">{capitalize(user?.role) || 'Staff'}</span>
          </span>
        </div>
        <nav>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="dash-nav-link"
                onMouseEnter={() => handleHover(item)}
                title={collapsed ? t(`nav.${item.key}`) : undefined}
              >
                <Icon className="dash-nav-icon" size={17} />
                <span className="dash-nav-label">{t(`nav.${item.key}`)}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="dash-main">
        <header className="dash-topbar">
          <button className="topbar-hamburger" onClick={() => setCollapsed((c) => !c)} title="Toggle sidebar" aria-label="Toggle sidebar">
            <FiMenu size={20} />
          </button>
          <TopbarSearch />
          <div className="dash-user">
            <NotificationBell />
            <LanguageSwitch />
            <span className="dash-shop-badge">
              <span className="dash-shop-badge-icon"><FiHome size={13} /></span>
              {shop?.name || 'My Shop'}
            </span>
            <UserMenu />
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
