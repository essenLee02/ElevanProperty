import api from './api.js'

export const rumah123Api = {
  /**
   * Cek status koneksi Apify
   */
  getStatus() {
    return api.get('/rumah123/status')
  },

  /**
   * Search properti via GET (params sederhana)
   * @param {object} params
   */
  search(params = {}) {
    return api.get('/rumah123/search', { params })
  },

  /**
   * Search properti via POST (params detail)
   * @param {object} body
   */
  searchPost(body = {}) {
    return api.post('/rumah123/search', body)
  },

  /**
   * Ambil data dari dataset yang sudah ada
   * @param {string} datasetId
   * @param {object} options - { offset, limit }
   */
  getDataset(datasetId, options = {}) {
    return api.get(`/rumah123/dataset/${datasetId}`, { params: options })
  },
}

export default rumah123Api
