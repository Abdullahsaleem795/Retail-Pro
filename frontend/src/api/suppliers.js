import apiClient from './client';

export const listSuppliers = (params) => apiClient.get('/suppliers', { params }).then((r) => r.data);
export const createSupplier = (payload) => apiClient.post('/suppliers', payload).then((r) => r.data);
export const updateSupplier = (id, payload) => apiClient.put(`/suppliers/${id}`, payload).then((r) => r.data);
export const deleteSupplier = (id) => apiClient.delete(`/suppliers/${id}`).then((r) => r.data);
