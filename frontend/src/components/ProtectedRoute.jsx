import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <div className="page-loader">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
