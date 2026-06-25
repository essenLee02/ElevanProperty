import api from './api';

/**
 * cityApi.js
 * Semua request ke endpoint /api/city/*
 */

export const getCityList = (params = {}) =>
  api.get('/city/list', { params }).then(r => r.data);

export const getCityDetail = (idCity) =>
  api.get(`/city/detail/${idCity}`).then(r => r.data);

export const insertCity = (payload) =>
  api.post('/city/insert', payload).then(r => r.data);

export const updateCity = (idCity, payload) =>
  api.put(`/city/update/${idCity}`, payload).then(r => r.data);

export const toggleCityStatus = (idCity) =>
  api.patch(`/city/toggle-status/${idCity}`).then(r => r.data);

export const deleteCity = (idCity) =>
  api.delete(`/city/delete/${idCity}`).then(r => r.data);
