/**
 * uploadPropertyImage.js
 *
 * Middleware multipart (multer) untuk upload gambar properti.
 *
 * Memakai memoryStorage — BUKAN diskStorage — supaya file baru ditulis ke disk
 * SETELAH controller memvalidasi bahwa property_id benar-benar ada & milik user
 * yang login. Dengan diskStorage, file sudah mendarat di disk sebelum validasi
 * dan menyisakan sampah bila validasi gagal.
 *
 * Batas dari .env (ada default wajar):
 *   PROPERTY_IMAGE_MAX_MB    (default 5)   — ukuran maksimum per file
 *   PROPERTY_IMAGE_MAX_FILES (default 10)  — jumlah file per request
 */

'use strict';

const multer = require('multer');
const { HTTP } = require('../utils/httpStatus');
const { sendError } = require('../utils/responseFormat');
const { ALLOWED_MIME, MAX_FILE_SIZE_MB, MAX_FILES } = require('../utils/propertyImageStorage');

/** Field name yang dipakai frontend pada FormData. */
const FIELD_NAME = 'images';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files:    MAX_FILES,
  },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME[String(file.mimetype || '').toLowerCase()]) return cb(null, true);
    // Pesan ini diteruskan ke handler error di bawah → jadi 400 yang informatif.
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

const uploadArray = upload.array(FIELD_NAME, MAX_FILES);

/**
 * Wrapper agar error multer menjadi respons JSON konsisten (format sendError)
 * alih-alih melempar ke error handler global Express.
 */
function uploadPropertyImages(req, res, next) {
  uploadArray(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE:       `Ukuran gambar maksimal ${MAX_FILE_SIZE_MB} MB per file`,
        LIMIT_FILE_COUNT:      `Maksimal ${MAX_FILES} gambar per upload`,
        LIMIT_UNEXPECTED_FILE: `Format gambar tidak didukung. Gunakan: ${Object.keys(ALLOWED_MIME).join(', ')}`,
      };
      return sendError(res, HTTP.BAD_REQUEST, null, messages[err.code] || `Upload gagal: ${err.code}`);
    }
    console.error('[UPLOAD PROPERTY IMAGE ERROR]', err.message);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memproses upload gambar');
  });
}

module.exports = { uploadPropertyImages, FIELD_NAME };
