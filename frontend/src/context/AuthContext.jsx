import { useEffect, useState, useCallback } from 'react';
import apiClient, { clearAuthTokens } from '../api/client';
import { AuthContext } from './authContextDef';
import { rememberUser } from '../utils/quickSwitch';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [shop, setShop] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Also used after a profile edit so the topbar reflects the new name without
  // forcing a re-login.
  const refreshUser = useCallback(async () => {
    const { data } = await apiClient.get('/auth/me');
    setUser(data.user);
    setShop(data.shop);
    setPermissions(data.permissions || []);
    return data;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await refreshUser();
      } catch {
        clearAuthTokens();
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    setShop(data.shop);
    setPermissions(data.permissions || []);
    rememberUser({ id: data.user.id, name: data.user.name, role: data.user.role, email: data.user.email, shopName: data.shop?.name });
    return data;
  }, []);

  // Quick-switch: re-authenticate as a different staff member on the same
  // shared PC with a short PIN instead of a full email+password login. See
  // frontend/src/utils/quickSwitch.js for the local "who's used this
  // browser" list this reads from.
  const pinLogin = useCallback(async (userId, pin) => {
    const { data } = await apiClient.post('/auth/pin-login', { userId, pin });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    setShop(data.shop);
    setPermissions(data.permissions || []);
    rememberUser({ id: data.user.id, name: data.user.name, role: data.user.role, email: data.user.email, shopName: data.shop?.name });
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await apiClient.post('/auth/register', payload);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    setShop(data.shop);
    setPermissions(data.permissions || []);
    rememberUser({ id: data.user.id, name: data.user.name, role: data.user.role, email: data.user.email, shopName: data.shop?.name });
    return data;
  }, []);

  const logout = useCallback(() => {
    clearAuthTokens();
    setUser(null);
    setShop(null);
    setPermissions([]);
  }, []);

  const can = useCallback((permission) => permissions.includes(permission), [permissions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        shop,
        permissions,
        loading,
        login,
        pinLogin,
        register,
        logout,
        refreshUser,
        can,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
