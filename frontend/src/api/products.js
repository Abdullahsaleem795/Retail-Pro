import apiClient from './client';

export const listProducts = (params) => apiClient.get('/products', { params }).then((r) => r.data);
export const getProduct = (id) => apiClient.get(`/products/${id}`).then((r) => r.data);
export const createProduct = (payload) => apiClient.post('/products', payload).then((r) => r.data);
export const updateProduct = (id, payload) => apiClient.put(`/products/${id}`, payload).then((r) => r.data);
export const deleteProduct = (id) => apiClient.delete(`/products/${id}`).then((r) => r.data);
export const adjustStock = (id, quantityChange, reason) =>
  apiClient.patch(`/products/${id}/stock`, { quantityChange, reason }).then((r) => r.data);
export const getProductByBarcode = (barcode) =>
  apiClient.get(`/products/barcode/${barcode}`).then((r) => r.data);
export const getExpiryAlerts = () => apiClient.get('/products/expiry-alerts').then((r) => r.data);
export const getLowStockAlerts = () => apiClient.get('/products/low-stock').then((r) => r.data);
export const bulkImportProducts = (products) =>
  apiClient.post('/products/bulk-import', { products }).then((r) => r.data);
