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

/* ── Gambar properti ──────────────────────────────────────────────────────────
   File fisik disimpan backend di /assets/image_data/<PROPERTY_ID>/, URL-nya
   dicatat di tabel property_images. Properti tanpa gambar otomatis memakai
   gambar default dari /assets/image_data/properties/<building_type>.png
──────────────────────────────────────────────────────────────────────────── */

export const getPropertyImages = (idProperty) =>
  api.get(`/property/${idProperty}/images`).then(r => r.data);

/**
 * Upload beberapa gambar sekaligus (multipart/form-data).
 * @param {string} idProperty
 * @param {File[]} files      - daftar File dari <input type="file" multiple>
 * @param {string[]} [names]  - label opsional, sejajar indeks dengan files
 */
export const uploadPropertyImages = (idProperty, files, names = []) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  names.forEach((n) => fd.append('names', n ?? ''));

  // ⚠️ WAJIB meng-override Content-Type instance menjadi undefined.
  // Instance `api` memasang default 'application/json'; pada axios 1.x, FormData
  // yang dikirim dengan Content-Type JSON akan DIUBAH menjadi JSON
  // (JSON.stringify(formDataToJSON(...))) sehingga file-nya hilang dan multer
  // menerima body kosong. Dengan undefined, browser mengisi sendiri
  // 'multipart/form-data; boundary=…'.
  return api.post(`/property/${idProperty}/images`, fd, {
    headers: { 'Content-Type': undefined },
  }).then(r => r.data);
};

export const deletePropertyImage = (idProperty, imageId) =>
  api.delete(`/property/${idProperty}/images/${imageId}`).then(r => r.data);
