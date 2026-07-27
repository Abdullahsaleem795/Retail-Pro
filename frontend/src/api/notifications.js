import apiClient from './client';

export const listNotifications = () => apiClient.get('/notifications').then((r) => r.data);
export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all').then((r) => r.data);
export const sendLowStockAlert = () => apiClient.post('/notifications/send-low-stock').then((r) => r.data);
export const sendSupplierOrderDraft = (supplierId) =>
  apiClient.post(`/notifications/supplier-order/${supplierId}`).then((r) => r.data);
