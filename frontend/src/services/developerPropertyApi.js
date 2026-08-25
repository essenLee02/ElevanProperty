import api from './api';

/**
 * developerPropertyApi.js
 * Semua request ke endpoint /api/developer-property/*
 */

export const getDeveloperPropertyList = (params = {}) =>
  api.get('/developer-property/list', { params }).then(r => r.data);

export const getDeveloperPropertyDetail = (developerPropertyId) =>
  api.get(`/developer-property/detail/${developerPropertyId}`).then(r => r.data);

/** Daftar ringkas developer AKTIF — untuk <select> (tidak ter-paginate). */
export const getDeveloperPropertyOptions = () =>
  api.get('/developer-property/options').then(r => r.data);

export const insertDeveloperProperty = (payload) =>
  api.post('/developer-property/insert', payload).then(r => r.data);

export const updateDeveloperProperty = (developerPropertyId, payload) =>
  api.put(`/developer-property/update/${developerPropertyId}`, payload).then(r => r.data);

export const toggleDeveloperPropertyStatus = (developerPropertyId) =>
  api.patch(`/developer-property/toggle-status/${developerPropertyId}`).then(r => r.data);

export const deleteDeveloperProperty = (developerPropertyId) =>
  api.delete(`/developer-property/delete/${developerPropertyId}`).then(r => r.data);
