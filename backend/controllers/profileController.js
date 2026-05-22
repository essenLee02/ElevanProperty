/**
 * profileController.js
 *
 * Controller untuk user profile management (update nama, phone, birthdate, username)
 * User TIDAK perlu confirm password untuk update data (direct update)
 *
 * Endpoint:
 *   GET  /api/profile/me   → getCurrentProfile (ambil data user yang login)
 *   PUT  /api/profile/update-agent → updateDataAgent (update nama, phone, birthdate, username)
 */

const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { authLog } = require('../utils/authLogger');

/**
 * Helper bersihkan value env
 */
function cleanEnv(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().replace(/^['"]|['"]$/g, '').replace(/[;\s]+$/g, '') || fallback;
}

function getRefreshCookieName() {
  return cleanEnv(process.env.COOKIE_REFRESH_TOKEN, 'Elevan_Refresh_Token');
}

/**
 * GET /api/profile/me
 *
 * Ambil data profile user yang sedang login (dari refresh_token cookie)
 * Memerlukan authentication (user harus login)
 */
exports.getCurrentProfile = async (req, res) => {
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;

  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'GET /api/profile/me'
  };

  try {
    // 1. Cek refresh_token di cookie
    if (!refreshTokenFromCookie) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
    }

    // 2. Cari user berdasarkan refresh_token
    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate', 'status']
    });

    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }

    // 3. Cek status user (1 = aktif)
    if (user.status !== 1) {
      return sendError(res, HTTP.FORBIDDEN, null, 'Akun tidak aktif');
    }

    return sendSuccess(res, HTTP.OK, { user }, 'Data profile ditemukan');
  } catch (error) {
    console.error('[PROFILE GET ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengambil profile');
  }
};

/**
 * PUT /api/profile/update-agent
 *
 * Update nama, phone, birthdate, username user (TANPA konfirmasi password)
 * User bisa langsung update, tidak perlu masukan password lama
 *
 * Body: { name, phone, birthdate, username }
 * Memerlukan authentication (user harus login)
 */
exports.updateDataAgent = async (req, res) => {
  const refreshCookieName = getRefreshCookieName();
  const refreshTokenFromCookie = req.cookies ? req.cookies[refreshCookieName] : null;
  const { name, phone, birthdate, username } = req.body;

  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'PUT /api/profile/update-agent'
  };

  try {
    // 1. Cek refresh_token di cookie
    if (!refreshTokenFromCookie) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Belum login');
    }

    // 2. Cari user berdasarkan refresh_token
    const user = await User.findOne({
      where: { refresh_token: refreshTokenFromCookie }
    });

    if (!user) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Token tidak dikenali');
    }

    // 3. Cek status user (1 = aktif)
    if (user.status !== 1) {
      return sendError(res, HTTP.FORBIDDEN, null, 'Akun tidak aktif');
    }

    // 4. Validasi input (minimal 1 field harus diubah)
    const updateFields = {};
    if (name && name.trim()) updateFields.name = String(name).trim().toUpperCase();
    if (phone && phone.trim()) updateFields.phone = phone.trim();
    if (birthdate) updateFields.birthdate = birthdate;
    if (username && username.trim()) {
      const trimmedUsername = String(username).trim().toLowerCase();
      // Cek apakah username baru sudah terpakai (dan bukan username sendiri)
      if (trimmedUsername !== user.username.toLowerCase()) {
        const existingUser = await User.findOne({
          where: { username: trimmedUsername }
        });
        if (existingUser) {
          return sendError(res, HTTP.CONFLICT, null, 'Username sudah terpakai');
        }
      }
      updateFields.username = trimmedUsername;
    }

    if (Object.keys(updateFields).length === 0) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Tidak ada data yang diubah');
    }

    // 5. Update data user
    updateFields.updated_date = new Date();
    updateFields.update_by = user.username;

    const updateResult = await User.update(updateFields, {
      where: { user_id: user.user_id }
    });

    if (!updateResult || updateResult[0] === 0) {
      console.warn('[PROFILE UPDATE] No rows updated', { user_id: user.user_id, updateFields });
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal update profil - data tidak berubah');
    }

    // 6. Ambil data user yang sudah diupdate
    const updatedUser = await User.findOne({
      where: { user_id: user.user_id },
      attributes: ['user_id', 'name', 'username', 'phone', 'birthdate']
    });

    // Log SUCCESS ke terminal
    authLog.profileUpdateSuccess(
      { user_id: user.user_id, username: user.username, name: user.name },
      {
        ...requestInfo,
        'Fields Updated': Object.keys(updateFields).filter(k => k !== 'updated_date' && k !== 'update_by').join(', '),
        'HTTP Status': HTTP.OK
      }
    );

    return sendSuccess(res, HTTP.OK, { user: updatedUser }, 'Profil berhasil diupdate');
  } catch (error) {
    console.error('[PROFILE UPDATE ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal update profil');
  }
};
