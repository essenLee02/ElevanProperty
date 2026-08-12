/**
 * registerController.js
 *
 * Controller untuk registrasi user baru ke tabel `users`.
 *
 * Rumus user_id: prefix nama + random alphanumeric + (users.count + 1)
 */

const bcrypt  = require('bcrypt');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { safeLog } = require('../utils/safeLog');
const { authLog } = require('../utils/authLogger');
const { validateUserBusinessFields } = require('../utils/userBusinessRules');
const GeneralController = require('./GeneralController');

class RegisterController extends GeneralController {
  static #saltRounds() {
    const raw    = String(process.env.BCRYPT_SALT_ROUNDS || '10').trim().replace(/[;\s]+$/g, '');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 4 && parsed <= 15 ? parsed : 10;
  }

  static async insertDataAgent(req, res) {
    const {
      name, birthdate, phone, username, password, konfirmasi, privilege, createdBy, email,
      ai_primary, trans_type, payment_type, rental_duration, rental_type,
    } = req.body;

    const requestInfo = {
      ip:    req.ip || req.connection?.remoteAddress || 'unknown',
      route: 'POST /api/auth/register'
    };

    if (!name || !username || !password) {
      authLog.registerFailed('Field name, username, dan password wajib diisi', {
        ...requestInfo,
        'HTTP Status':   HTTP.BAD_REQUEST,
        'Username Input': username || '(kosong)',
        'Name Input':     name     || '(kosong)'
      });
      return sendError(res, HTTP.BAD_REQUEST, null, 'Field name, username, dan password wajib diisi');
    }

    if (password !== konfirmasi) {
      authLog.registerFailed('Password dan Konfirmasi tidak cocok', {
        ...requestInfo,
        'HTTP Status':   HTTP.BAD_REQUEST,
        'Username Input': username
      });
      return sendError(res, HTTP.BAD_REQUEST, null, 'Password dan Konfirmasi tidak cocok');
    }

    if (String(password).length < 6) {
      authLog.registerFailed('Password kurang dari 6 karakter', {
        ...requestInfo,
        'HTTP Status':    HTTP.BAD_REQUEST,
        'Username Input': username,
        'Password Length': String(password).length
      });
      return sendError(res, HTTP.BAD_REQUEST, null, 'Password minimal 6 karakter');
    }

    // Email — opsional, tapi jika diisi harus format valid
    const cleanEmail = email !== undefined && email !== null ? String(email).trim() : '';
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      authLog.registerFailed('Format email tidak valid', {
        ...requestInfo,
        'HTTP Status':    HTTP.BAD_REQUEST,
        'Username Input': username,
        'Email Input':    email
      });
      return sendError(res, HTTP.BAD_REQUEST, null, 'Format email tidak valid');
    }

    // trans_type / payment_type / rental_* / ai_primary — saling terikat, satu
    // sumber kebenaran di utils/userBusinessRules.js. Divalidasi SEBELUM query
    // apa pun supaya input tidak sah tidak menyentuh DB.
    const business = validateUserBusinessFields({
      ai_primary, trans_type, payment_type, rental_duration, rental_type,
    });
    if (!business.ok) {
      authLog.registerFailed(business.error, {
        ...requestInfo,
        'HTTP Status':    HTTP.BAD_REQUEST,
        'Username Input': username,
      });
      return sendError(res, HTTP.BAD_REQUEST, null, business.error);
    }

    try {
      const existingUser = await User.findOne({ where: { username: String(username).trim() } });
      if (existingUser) {
        authLog.registerFailed('Username sudah terpakai', {
          ...requestInfo,
          'HTTP Status':     HTTP.CONFLICT,
          'Username Input':  username,
          'Existing User ID': existingUser.user_id
        });
        return sendError(res, HTTP.CONFLICT, null, 'Username sudah terpakai, silakan pilih yang lain');
      }

      const saltRounds    = RegisterController.#saltRounds();
      const salt          = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);

      const totalUsers  = await User.count();
      const newUserId   = GeneralController.generateRandomId(name, totalUsers).toUpperCase();
      const formattedName = String(name).trim().toUpperCase();

      const createdByValue = (createdBy && String(createdBy).trim() !== '')
        ? String(createdBy).trim().replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase())
        : 'Self-Register';

      const newUser = await User.create({
        user_id:       newUserId,
        name:          formattedName,
        birthdate:     birthdate || null,
        phone:         phone ? String(phone).trim() : null,
        username:      String(username).trim(),
        password:      hashedPassword,
        email:         cleanEmail || null,
        catalog_summary: 'OFF', // default OFF saat register — bisa diubah di halaman profile
        ...business.values,     // ai_primary, trans_type, payment_type, rental_duration, rental_type
        refresh_token: null,
        updated_date:  null,
        update_by:     null,
        created_date:  new Date(),
        created_by:    createdByValue,
        status:        1,
        privilege:     privilege || 'agent'
      });

      authLog.registerSuccess({
        user_id:  newUser.user_id,
        username: newUser.username,
        name:     newUser.name
      }, {
        ...requestInfo,
        'HTTP Status': HTTP.CREATED,
        'Phone':       newUser.phone    || '(kosong)',
        'Birthdate':   newUser.birthdate || '(kosong)',
        'Email':       newUser.email    || '(kosong)',
        'Created By':  newUser.created_by,
        'Total Users': totalUsers + 1
      });

      const safeUser = {
        id:           newUser.id,
        user_id:      newUser.user_id,
        name:         newUser.name,
        birthdate:    newUser.birthdate,
        phone:        newUser.phone,
        username:     newUser.username,
        email:        newUser.email,
        catalog_summary: newUser.catalog_summary,
        ai_primary:      newUser.ai_primary,
        trans_type:      newUser.trans_type,
        payment_type:    newUser.payment_type,
        rental_duration: newUser.rental_duration,
        rental_type:     newUser.rental_type,
        status:       newUser.status,
        privilege:    newUser.privilege,
        created_date: newUser.created_date,
        created_by:   newUser.created_by
      };

      return sendSuccess(res, HTTP.CREATED, safeUser, 'Sukses register');

    } catch (error) {
      authLog.registerFailed('Server error: ' + (error.message || 'Unknown error'), {
        ...requestInfo,
        'HTTP Status':   HTTP.INTERNAL_SERVER_ERROR,
        'Username Input': username,
        'Error Stack':    error.stack ? error.stack.split('\n')[0] : ''
      });
      console.error('[REGISTER ERROR]', error);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal register: ' + (error.message || 'Unknown error'));
    }
  }

  static async countUsers(req, res) {
    try {
      const total = await User.count();
      return sendSuccess(res, HTTP.OK, { total }, 'Jumlah user');
    } catch (error) {
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, error.message);
    }
  }
}

module.exports = RegisterController;
