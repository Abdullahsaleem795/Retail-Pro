import apiClient from './client';

export const getShopSettings = () => apiClient.get('/shop').then((r) => r.data);
export const updateShopSettings = (payload) => apiClient.put('/shop', payload).then((r) => r.data);
export const listUsers = () => apiClient.get('/shop/users').then((r) => r.data);
export const createUser = (payload) => apiClient.post('/shop/users', payload).then((r) => r.data);
export const updateUser = (id, payload) => apiClient.put(`/shop/users/${id}`, payload).then((r) => r.data);
export const deleteUser = (id) => apiClient.delete(`/shop/users/${id}`).then((r) => r.data);
export const getGrantablePermissions = () => apiClient.get('/shop/permissions').then((r) => r.data);
export const requestSubscriptionUpgrade = (payload) => apiClient.post('/shop/subscription/request-upgrade', payload).then((r) => r.data);
// Activation is admin-only now (see /api/admin/*, frontend/src/pages/AdminConsole.jsx) -
// a shop owner can no longer self-activate their own paid plan.
export const getPaymentAccounts = () => apiClient.get('/shop/payment-accounts').then((r) => r.data);
