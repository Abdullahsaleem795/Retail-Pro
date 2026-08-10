import { lazy, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));

// Dashboard pages are code-split so the initial load stays small. This matters
// for shopkeepers on slow mobile data - charting libs only download when the
// dashboard or reports screen is actually opened.
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const POS = lazy(() => import('./pages/dashboard/POS'));
const Inventory = lazy(() => import('./pages/dashboard/Inventory'));
const ExpiryAlerts = lazy(() => import('./pages/dashboard/ExpiryAlerts'));
const Sales = lazy(() => import('./pages/dashboard/Sales'));
const Purchases = lazy(() => import('./pages/dashboard/Purchases'));
const Reports = lazy(() => import('./pages/dashboard/Reports'));
const Suppliers = lazy(() => import('./pages/dashboard/Suppliers'));
const Customers = lazy(() => import('./pages/dashboard/Customers'));
const Expenses = lazy(() => import('./pages/dashboard/Expenses'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const Upgrade = lazy(() => import('./pages/dashboard/Upgrade'));
const Categories = lazy(() => import('./pages/dashboard/Categories'));
const Staff = lazy(() => import('./pages/dashboard/Staff'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
const Branches = lazy(() => import('./pages/dashboard/Branches'));
const AdminConsole = lazy(() => import('./pages/AdminConsole'));
const AdminConfirmActivation = lazy(() =>
  import('./pages/AdminConsole').then((m) => ({ default: m.ConfirmActivation }))
);
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  useEffect(() => {
    document.title = 'Retail Pro';
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Platform-operator console - gated by PLATFORM_ADMIN_KEY (a header
              the user enters, not a shop JWT), so it lives outside ProtectedRoute
              on purpose: it manages ALL shops, not one signed-in shop's data. */}
          <Route path="/admin" element={<AdminConsole />} />
          {/* One-click "Confirm & Activate" link from the upgrade-request
              email/WhatsApp ping - same admin-key gate as /admin above. */}
          <Route path="/admin/confirm/:token" element={<AdminConfirmActivation />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="expiry-alerts" element={<ExpiryAlerts />} />
              <Route path="sales" element={<Sales />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="reports" element={<Reports />} />
              <Route path="branches" element={<Branches />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="customers" element={<Customers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="categories" element={<Categories />} />
              <Route path="staff" element={<Staff />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="upgrade" element={<Upgrade />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
