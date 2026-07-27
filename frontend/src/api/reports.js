import apiClient from './client';

export const getDashboardSummary = () => apiClient.get('/reports/dashboard').then((r) => r.data);
export const getSalesTrend = (days) => apiClient.get('/reports/sales-trend', { params: { days } }).then((r) => r.data);
export const getProfitReport = (params) => apiClient.get('/reports/profit', { params }).then((r) => r.data);
export const getBestSellers = (params) => apiClient.get('/reports/best-sellers', { params }).then((r) => r.data);
export const getDeadStock = (params) => apiClient.get('/reports/dead-stock', { params }).then((r) => r.data);
export const getFastMoving = (params) => apiClient.get('/reports/fast-moving', { params }).then((r) => r.data);
export const getLowMargin = (params) => apiClient.get('/reports/low-margin', { params }).then((r) => r.data);
export const getReorderSuggestions = (params) => apiClient.get('/reports/reorder', { params }).then((r) => r.data);
