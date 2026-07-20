import api from './api';

/**
 * customerApi.js
 * Semua request ke endpoint /api/customer/*
 *
 * Data customer terisi otomatis oleh AI (saat summary WhatsApp) + manual agent.
 */

export const getCustomerList = (params = {}) =>
  api.get('/customer/list', { params }).then(r => r.data);

export const getCustomerDetail = (idCustomer) =>
  api.get(`/customer/detail/${idCustomer}`).then(r => r.data);

export const insertCustomer = (payload) =>
  api.post('/customer/insert', payload).then(r => r.data);

export const updateCustomer = (idCustomer, payload) =>
  api.put(`/customer/update/${idCustomer}`, payload).then(r => r.data);

export const toggleCustomerStatus = (idCustomer) =>
  api.patch(`/customer/toggle-status/${idCustomer}`).then(r => r.data);

export const toggleCustomerAi = (idCustomer) =>
  api.patch(`/customer/toggle-ai/${idCustomer}`).then(r => r.data);

export const deleteCustomer = (idCustomer) =>
  api.delete(`/customer/delete/${idCustomer}`).then(r => r.data);
