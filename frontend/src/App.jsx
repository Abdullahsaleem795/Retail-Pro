import { lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Dashboard pages are code-split so the initial load stays small. This matters
// for shopkeepers on slow mobile data - charting libs only download when the
// dashboard or reports screen is actually opened.
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const POS = lazy(() => import('./pages/dashboard/POS'));
const Inventory = lazy(() => import('./pages/dashboard/Inventory'));
const Sales = lazy(() => import('./pages/dashboard/Sales'));
const Purchases = lazy(() => import('./pages/dashboard/Purchases'));
const Reports = lazy(() => import('./pages/dashboard/Reports'));
const Suppliers = lazy(() => import('./pages/dashboard/Suppliers'));
const Customers = lazy(() => import('./pages/dashboard/Customers'));
const Expenses = lazy(() => import('./pages/dashboard/Expenses'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const Categories = lazy(() => import('./pages/dashboard/Categories'));
const Staff = lazy(() => import('./pages/dashboard/Staff'));
const Profile = lazy(() => import('./pages/dashboard/Profile'));
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

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="sales" element={<Sales />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="reports" element={<Reports />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="customers" element={<Customers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="categories" element={<Categories />} />
              <Route path="staff" element={<Staff />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
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
