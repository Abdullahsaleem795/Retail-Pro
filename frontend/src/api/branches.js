import apiClient from './client';

export const listBranches = () => apiClient.get('/branches').then((r) => r.data);
export const createBranch = (payload) => apiClient.post('/branches', payload).then((r) => r.data);
export const updateBranch = (id, payload) => apiClient.put(`/branches/${id}`, payload).then((r) => r.data);
export const deleteBranch = (id) => apiClient.delete(`/branches/${id}`).then((r) => r.data);

export const listTransfers = (params) => apiClient.get('/branches/transfers', { params }).then((r) => r.data);
export const createTransfer = (payload) => apiClient.post('/branches/transfers', payload).then((r) => r.data);
export const markTransferInTransit = (id) => apiClient.put(`/branches/transfers/${id}/in-transit`).then((r) => r.data);
export const receiveTransfer = (id) => apiClient.put(`/branches/transfers/${id}/receive`).then((r) => r.data);
export const cancelTransfer = (id) => apiClient.put(`/branches/transfers/${id}/cancel`).then((r) => r.data);
