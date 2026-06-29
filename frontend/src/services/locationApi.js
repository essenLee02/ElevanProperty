import api from './api';

/**
 * locationApi.js
 * Semua request ke endpoint /api/location/*
 *
 * Lokasi master: daftar lokasi rujukan untuk pencarian properti
 * (Pasar, PTC, Cafe, Kebun Binatang, Indomaret, dll.)
 */

export const getLocationList = (params = {}) => {
  const queryParams = {
    page: params.page || 1,
    search: params.search || ''
  };
  return api.get('/location/list', { params: queryParams }).then(r => r.data);
};

export const getLocationDetail = (locationId) =>
  api.get(`/location/detail/${locationId}`).then(r => r.data);

export const insertLocation = (payload) =>
  api.post('/location/insert', payload).then(r => r.data);

export const updateLocation = (locationId, payload) =>
  api.put(`/location/update/${locationId}`, payload).then(r => r.data);

export const toggleLocationStatus = (locationId) =>
  api.patch(`/location/toggle-status/${locationId}`).then(r => r.data);

export const deleteLocation = (locationId) =>
  api.delete(`/location/delete/${locationId}`).then(r => r.data);
