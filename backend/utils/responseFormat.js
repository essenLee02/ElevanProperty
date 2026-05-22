/**
 * responseFormat.js
 *
 * Helper untuk format respon controller yang konsisten.
 *
 * Format respon (sesuai requirement user):
 * {
 *   status:  <HTTP status code dari .env>,
 *   data: {
 *     response: <isi data: rows array, token, user object, dll>,
 *     message:  <pesan user-friendly>
 *   },
 *   isSuccess: 1 | 2   // 1=sukses, 2=gagal (kompatibel dengan pola mom_logistic)
 * }
 *
 * Cara pakai:
 *   const { sendSuccess, sendError } = require('../utils/responseFormat');
 *   return sendSuccess(res, HTTP.OK, { token, user }, 'Login berhasil');
 *   return sendError(res, HTTP.UNAUTHORIZED, null, 'Username atau password salah');
 */

const { HTTP } = require('./httpStatus');

/**
 * Kirim respon SUKSES (isSuccess = 1).
 *
 * @param {object} res        - Express response object
 * @param {number} statusCode - HTTP status code (dari HTTP.* di .env)
 * @param {*}      response   - Payload data (rows, token, user, dll)
 * @param {string} message    - Pesan user-friendly
 * @returns {object} Express response
 */
function sendSuccess(res, statusCode, response, message) {
  return res.status(statusCode || HTTP.OK).json({
    status:    statusCode || HTTP.OK,
    data: {
      response: response !== undefined ? response : null,
      message:  message  || 'Sukses'
    },
    isSuccess: 1
  });
}

/**
 * Kirim respon ERROR (isSuccess = 2).
 *
 * @param {object} res        - Express response object
 * @param {number} statusCode - HTTP status code (dari HTTP.* di .env)
 * @param {*}      response   - Detail error (opsional, biasanya null)
 * @param {string} message    - Pesan error user-friendly
 * @returns {object} Express response
 */
function sendError(res, statusCode, response, message) {
  return res.status(statusCode || HTTP.INTERNAL_SERVER_ERROR).json({
    status:    statusCode || HTTP.INTERNAL_SERVER_ERROR,
    data: {
      response: response !== undefined ? response : null,
      message:  message  || 'Terjadi kesalahan'
    },
    isSuccess: 2
  });
}

module.exports = { sendSuccess, sendError };
