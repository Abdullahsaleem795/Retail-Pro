import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Clears only the auth tokens, not the whole of localStorage - the
// quick-switch "who's used this browser" list (utils/quickSwitch.js) has to
// survive a logout/session-expiry, otherwise every sign-out would silently
// wipe the one thing quick-switch exists to avoid retyping.
export const clearAuthTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queuedRequests = [];

const processQueue = (token) => {
  queuedRequests.forEach((cb) => cb(token));
  queuedRequests = [];
};

// A 401 from these endpoints means "wrong credentials", not "your session
// expired" - there was never a session to begin with. Letting the
// session-expiry handling below fire for them force-reloads the page via
// window.location.href before Login.jsx/Register.jsx's own catch block can
// render the error, so the user sees the form silently flicker and clear
// with zero feedback about what went wrong.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/pin-login'];
const isAuthEndpoint = (url) => AUTH_ENDPOINTS.some((path) => url?.includes(path));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        clearAuthTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          queuedRequests.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem('accessToken', data.accessToken);
        processQueue(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearAuthTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const updateProfile = (payload) => apiClient.put('/auth/profile', payload).then((r) => r.data);
export const changePassword = (currentPassword, newPassword) =>
  apiClient.put('/auth/password', { currentPassword, newPassword }).then((r) => r.data);
export const setPin = (currentPassword, pin) =>
  apiClient.put('/auth/pin', { currentPassword, pin }).then((r) => r.data);
export const removePin = () => apiClient.delete('/auth/pin').then((r) => r.data);

export default apiClient;
