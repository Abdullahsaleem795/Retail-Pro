import apiClient from './client';

export const listCustomers = (params) => apiClient.get('/customers', { params }).then((r) => r.data);
export const createCustomer = (payload) => apiClient.post('/customers', payload).then((r) => r.data);
export const updateCustomer = (id, payload) => apiClient.put(`/customers/${id}`, payload).then((r) => r.data);
export const deleteCustomer = (id) => apiClient.delete(`/customers/${id}`).then((r) => r.data);
