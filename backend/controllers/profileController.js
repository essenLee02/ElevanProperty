/**
 * profileController.js
 *
 * Controller untuk user profile management.
 *
 * Rules:
 * - Username TIDAK bisa diupdate (read-only)
 * - Nama, Nomor HP, dan Password WAJIB diisi saat update
 * - Fonnte API boleh kosong (nullable)
 * - Birthdate opsional
 *
 * Endpoint:
 *   GET  /api/profile/me            → getCurrentProfile
 *   PUT  /api/profile/update-agent  → updateDataAgent
 */

const bcrypt  = require('bcrypt');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { authLog } = require('../utils/authLogger');
const { validateUserBusinessFields } = require('../utils/userBusinessRules');

/* ─────────────────────────────────────────────
   Helper
───────────────────────────────────────────── */
function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

function getSaltRounds() {
  const raw    = String(process.env.BCRYPT_SALT_ROUNDS || '10').trim().replace(/[;\s]+$/g, '');
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 4 && parsed <= 15 ? parsed : 10;
}

/* ─────────────────────────────────────────────
   GET /api/profile/me
───────────────────────────────────────────── */
exports.getCurrentProfile = async (req, res) => {
  const refreshCookieName      = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  try {
    if (!refreshTokenFromCookie) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
    }

    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'status', 'email', 'catalog_summary', 'fonnte_token', 'kirimi_device_id', 'ai_primary', 'trans_type', 'payment_type', 'rental_duration', 'rental_type']
    });

    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }

    if (user.status !== 1) {
      return sendError(res, HTTP.FORBIDDEN, null, 'Akun tidak aktif');
    }

    return sendSuccess(res, HTTP.OK, { user }, 'Data profile ditemukan');
  } catch (error) {
    console.error('[PROFILE GET ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengambil profile');
  }
};

/* ─────────────────────────────────────────────
   PUT /api/profile/update-agent
───────────────────────────────────────────── */
exports.updateDataAgent = async (req, res) => {
  const refreshCookieName      = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  // username sengaja TIDAK diambil dari body — tidak boleh diupdate
  const {
    name, phone, birthdate, password, fonnte_token, kirimi_device_id, email, catalog_summary,
    ai_primary, trans_type, payment_type, rental_duration, rental_type,
  } = req.body;

  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'PUT /api/profile/update-agent'
  };

  try {
    /* 1. Auth check ─────────────────────────── */
    if (!refreshTokenFromCookie) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
    }

    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie }
    });

    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }

    if (user.status !== 1) {
      return sendError(res, HTTP.FORBIDDEN, null, 'Akun tidak aktif');
    }

    /* 2. Validasi field WAJIB ───────────────── */
    const cleanName     = String(name  || '').trim();
    const cleanPhone    = String(phone || '').trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanName) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama wajib diisi');
    }

    if (!cleanPhone) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nomor HP wajib diisi');
    }

    if (!cleanPassword) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Password wajib diisi');
    }

    if (cleanPassword.length < 6) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Password minimal 6 karakter');
    }

    // Email — opsional, tapi jika diisi harus format valid
    const cleanEmail = email !== undefined && email !== null ? String(email).trim() : '';
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Format email tidak valid');
    }

    // Catalog Summary Status — opsional, tapi jika diisi harus 'ON' atau 'OFF'
    const cleanCatalogSummary = catalog_summary !== undefined && catalog_summary !== null
      ? String(catalog_summary).trim().toUpperCase()
      : '';
    if (cleanCatalogSummary && !['ON', 'OFF'].includes(cleanCatalogSummary)) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Catalog Summary Status harus ON atau OFF');
    }

    /* 3. Susun updateFields ─────────────────── */
    const updateFields = {};

    // Nama — uppercase
    updateFields.name = cleanName.toUpperCase();

    // Nomor HP
    updateFields.phone = cleanPhone;

    // Birthdate — opsional
    if (birthdate) {
      updateFields.birthdate = birthdate;
    }

    // Password — hash dulu
    const salt           = await bcrypt.genSalt(getSaltRounds());
    updateFields.password = await bcrypt.hash(cleanPassword, salt);

    // Fonnte API — boleh kosong / null
    const cleanFonnte = fonnte_token !== undefined && fonnte_token !== null
      ? String(fonnte_token).trim()
      : null;
    updateFields.fonnte_token = cleanFonnte || null;

    // Kirimi Device ID — boleh kosong / null
    const cleanKirimi = kirimi_device_id !== undefined && kirimi_device_id !== null
      ? String(kirimi_device_id).trim()
      : null;
    updateFields.kirimi_device_id = cleanKirimi || null;

    // Email — boleh kosong / null
    updateFields.email = cleanEmail || null;

    // Catalog Summary Status — boleh kosong / null (ON = Summary with catalog, OFF = Summary without catalog)
    updateFields.catalog_summary = cleanCatalogSummary || null;

    // ai_primary / trans_type / payment_type / rental_* — saling terikat.
    // `user` (baris tersimpan) diteruskan sebagai `current` supaya update PARSIAL
    // tidak menghapus nilai lama: kirim trans_type saja → payment_type & rental_*
    // disesuaikan otomatis mengikuti aturan, bukan di-null-kan diam-diam.
    const business = validateUserBusinessFields(
      { ai_primary, trans_type, payment_type, rental_duration, rental_type },
      user,
    );
    if (!business.ok) {
      return sendError(res, HTTP.BAD_REQUEST, null, business.error);
    }
    Object.assign(updateFields, business.values);

    // Metadata update
    updateFields.updated_date = new Date();
    updateFields.update_by    = user.username;

    /* 4. Simpan ke database ─────────────────── */
    const updateResult = await User.update(updateFields, {
      where: { user_id: user.user_id }
    });

    if (!updateResult || updateResult[0] === 0) {
      console.warn('[PROFILE UPDATE] No rows updated', { user_id: user.user_id });
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal update profil');
    }

    /* 5. Kembalikan data terbaru (tanpa password) */
    const updatedUser = await User.findOne({
      where: { user_id: user.user_id },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'email', 'catalog_summary', 'fonnte_token', 'kirimi_device_id', 'ai_primary', 'trans_type', 'payment_type', 'rental_duration', 'rental_type']
    });

    // Log ke terminal
    authLog.profileUpdateSuccess(
      { user_id: user.user_id, username: user.username, name: user.name },
      {
        ...requestInfo,
        'Fields Updated': Object.keys(updateFields)
          .filter(k => !['updated_date', 'update_by', 'password'].includes(k))
          .join(', '),
        'Password Changed': true,
        'HTTP Status': HTTP.OK
      }
    );

    return sendSuccess(res, HTTP.OK, { user: updatedUser }, 'Profil berhasil diupdate');

  } catch (error) {
    console.error('[PROFILE UPDATE ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal update profil');
  }
};
