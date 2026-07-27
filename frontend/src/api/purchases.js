import apiClient from './client';

export const listPurchases = (params) => apiClient.get('/purchases', { params }).then((r) => r.data);
export const getPurchase = (id) => apiClient.get(`/purchases/${id}`).then((r) => r.data);
export const createPurchase = (payload) => apiClient.post('/purchases', payload).then((r) => r.data);
export const markPurchaseReceived = (id) => apiClient.patch(`/purchases/${id}/receive`).then((r) => r.data);
export const cancelPurchase = (id) => apiClient.patch(`/purchases/${id}/cancel`).then((r) => r.data);
