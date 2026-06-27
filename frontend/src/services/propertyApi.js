import api from './api';

/**
 * propertyApi.js
 * Semua request ke endpoint /api/property/*
 */

export const getPropertyList = (params = {}) =>
  api.get('/property/list', { params }).then(r => r.data);

export const getPropertyDetail = (idProperty) =>
  api.get(`/property/detail/${idProperty}`).then(r => r.data);

export const insertProperty = (payload) =>
  api.post('/property/insert', payload).then(r => r.data);

export const updateProperty = (idProperty, payload) =>
  api.put(`/property/update/${idProperty}`, payload).then(r => r.data);

export const togglePropertyStatus = (idProperty) =>
  api.patch(`/property/toggle-status/${idProperty}`).then(r => r.data);

export const deleteProperty = (idProperty) =>
  api.delete(`/property/delete/${idProperty}`).then(r => r.data);
