import api from './api';

/**
 * provinceApi.js
 * Semua request ke endpoint /api/province/*
 */

export const getProvinceList = (params = {}) =>
  api.get('/province/list', { params }).then(r => r.data);

export const getProvinceDetail = (idProvince) =>
  api.get(`/province/detail/${idProvince}`).then(r => r.data);

export const insertProvince = (payload) =>
  api.post('/province/insert', payload).then(r => r.data);

export const updateProvince = (idProvince, payload) =>
  api.put(`/province/update/${idProvince}`, payload).then(r => r.data);

export const toggleProvinceStatus = (idProvince) =>
  api.patch(`/province/toggle-status/${idProvince}`).then(r => r.data);

export const deleteProvince = (idProvince) =>
  api.delete(`/province/delete/${idProvince}`).then(r => r.data);

/** Daftar provinsi aktif (opsional filter by negara) untuk dropdown parent City. */
export const getProvinceOptions = (idCountry = null) =>
  api.get('/province/options', { params: idCountry ? { country_id: idCountry } : {} })
    .then(r => r.data);
