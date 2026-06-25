import api from './api';

/**
 * countryApi.js
 * Semua request ke endpoint /api/country/*
 */

export const getCountryList = (params = {}) =>
  api.get('/country/list', { params }).then(r => r.data);

export const getCountryDetail = (idCountry) =>
  api.get(`/country/detail/${idCountry}`).then(r => r.data);

export const insertCountry = (payload) =>
  api.post('/country/insert', payload).then(r => r.data);

export const updateCountry = (idCountry, payload) =>
  api.put(`/country/update/${idCountry}`, payload).then(r => r.data);

export const toggleCountryStatus = (idCountry) =>
  api.patch(`/country/toggle-status/${idCountry}`).then(r => r.data);

export const deleteCountry = (idCountry) =>
  api.delete(`/country/delete/${idCountry}`).then(r => r.data);

/** Daftar negara aktif untuk dropdown parent (Province/City). */
export const getCountryOptions = () =>
  api.get('/country/options').then(r => r.data);
