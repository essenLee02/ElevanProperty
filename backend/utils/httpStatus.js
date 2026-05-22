/**
 * httpStatus.js
 *
 * Helper untuk membaca HTTP status code dari .env supaya konsisten
 * di seluruh controller. Kalau .env tidak ada, fallback ke nilai default
 * sesuai standar HTTP.
 *
 * Cara pakai:
 *   const { HTTP } = require('../utils/httpStatus');
 *   return res.status(HTTP.OK).json(...);
 */

/**
 * Ambil status code dari env, bersihkan dari karakter aneh (seperti ";" di akhir
 * yang sering ada di file .env Indonesia), dan convert ke integer.
 *
 * @param {string} envName - Nama environment variable (mis. "HTTP_OK")
 * @param {number} fallback - Default value kalau env tidak ada
 * @returns {number} HTTP status code
 */
function readStatus(envName, fallback) {
  const raw = process.env[envName];
  if (raw === undefined || raw === null || raw === '') return fallback;

  const cleaned = String(raw).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * HTTP status code yang dipakai di seluruh aplikasi.
 * Semua nilai bisa di-override dari .env supaya seragam.
 */
const HTTP = {
  OK:                    readStatus('HTTP_OK', 200),
  CREATED:               readStatus('HTTP_CREATED', 201),
  NO_CONTENT:            readStatus('HTTP_NO_CONTENT', 204),
  BAD_REQUEST:           readStatus('HTTP_BAD_REQUEST', 400),
  UNAUTHORIZED:          readStatus('HTTP_UNAUTHORIZED', 401),
  FORBIDDEN:             readStatus('HTTP_FORBIDDEN', 403),
  NOT_FOUND:             readStatus('HTTP_NOT_FOUND', 404),
  CONFLICT:              readStatus('HTTP_CONFLICT', 409),
  INTERNAL_SERVER_ERROR: readStatus('HTTP_INTERNAL_SERVER_ERROR', 500),
  NOT_IMPLEMENTED:       readStatus('HTTP_NOT_IMPLEMENTED', 501),
  BAD_GATEWAY:           readStatus('HTTP_BAD_GATEWAY', 502),
  SERVICE_UNAVAILABLE:   readStatus('HTTP_SERVICE_UNAVAILABLE', 503),
};

module.exports = { HTTP };
