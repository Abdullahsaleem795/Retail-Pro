import apiClient from './client';

export const listSales = (params) => apiClient.get('/sales', { params }).then((r) => r.data);
export const getSalesSummary = () => apiClient.get('/sales/summary').then((r) => r.data);
export const getSale = (id) => apiClient.get(`/sales/${id}`).then((r) => r.data);
export const createSale = (payload) => apiClient.post('/sales', payload).then((r) => r.data);
export const refundSale = (id) => apiClient.patch(`/sales/${id}/refund`).then((r) => r.data);
export const downloadReceipt = (id) =>
  apiClient.get(`/sales/${id}/receipt`, { responseType: 'blob' }).then((r) => r.data);
