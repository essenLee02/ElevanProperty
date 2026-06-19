import api from './api';

/**
 * facilityApi.js
 * Semua request ke endpoint /api/facility/*
 */

export const getFacilityList = (params = {}) =>
  api.get('/facility/list', { params }).then(r => r.data);

export const getFacilityDetail = (facilityId) =>
  api.get(`/facility/detail/${facilityId}`).then(r => r.data);

export const insertFacility = (payload) =>
  api.post('/facility/insert', payload).then(r => r.data);

export const updateFacility = (facilityId, payload) =>
  api.put(`/facility/update/${facilityId}`, payload).then(r => r.data);

export const toggleFacilityStatus = (facilityId) =>
  api.patch(`/facility/toggle-status/${facilityId}`).then(r => r.data);

export const deleteFacility = (facilityId) =>
  api.delete(`/facility/delete/${facilityId}`).then(r => r.data);
