import apiClient from './client';

export const listExpenses = (params) => apiClient.get('/expenses', { params }).then((r) => r.data);
export const createExpense = (payload) => apiClient.post('/expenses', payload).then((r) => r.data);
export const updateExpense = (id, payload) => apiClient.put(`/expenses/${id}`, payload).then((r) => r.data);
export const deleteExpense = (id) => apiClient.delete(`/expenses/${id}`).then((r) => r.data);
