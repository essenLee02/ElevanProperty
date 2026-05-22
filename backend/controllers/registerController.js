/**
 * registerController.js
 *
 * Controller untuk registrasi user baru ke tabel `users`.
 *
 * Function utama: `insertDataAgent` (nama sesuai requirement user, dipakai
 * sama seperti `insertDataPegawai` di Controller_Pegawai.js mom_logistic).
 *
 * Rumus user_id: prefix nama + random alphanumeric + (users.count + 1)
 * Reference rumus: makeIdFunction(nama, jumlah) di Controller_Pegawai.js
 */

const bcrypt = require('bcrypt');
const { User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { safeLog } = require('../utils/safeLog');
const { authLog } = require('../utils/authLogger');

/**
 * Ambil bcrypt salt rounds dari .env. Default 10 (recommended).
 */
function getSaltRounds() {
  const raw = String(process.env.BCRYPT_SALT_ROUNDS || '10').trim().replace(/[;\s]+$/g, '');
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 4 && parsed <= 15 ? parsed : 10;
}

/**
 * Generate random alphanumeric string (campuran huruf besar/kecil + angka).
 *
 * @param {number} length - Panjang string yang diinginkan
 * @returns {string} Random alphanumeric string
 */
function generateRandomString(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate user_id otomatis dengan rumus:
 *   [prefix nama] + [random 5 huruf/angka] + [(users.count + 1) di-pad 3 digit]
 *
 * Contoh:
 *   "Nigel Tjandra" + 5 user existing → "NTAb3xK006"
 *   "John" (satu kata) + 0 user        → "JOaBcDe001"
 *
 * Reference: makeIdFunction(nama, jumlah) di Controller_Pegawai.js mom_logistic
 *
 * @param {string} nama - Nama user
 * @param {number} jumlah - Jumlah user existing di database (users.count)
 * @returns {string} user_id yang siap dipakai
 */
function makeUserIdFunction(nama, jumlah) {
  let id = '';
  jumlah += 1; // users.count + 1

  const cleanNama = String(nama || '').trim();
  const panjangNama = cleanNama.split(/\s+/);
  let prefix = '';

  if (panjangNama.length < 2) {
    // Nama satu kata: ambil dua huruf pertama
    const huruf1 = (cleanNama[0] || 'X').toUpperCase();
    const huruf2 = (cleanNama[1] || 'X').toUpperCase();
    prefix = huruf1 + huruf2;
  } else {
    // Nama beberapa kata: huruf pertama nama depan + huruf pertama nama belakang
    prefix = panjangNama[0][0].toUpperCase() +
             panjangNama[panjangNama.length - 1].substring(0, 1).toUpperCase();
  }

  const randomString = generateRandomString(5);

  let numberStr = '';
  if (jumlah < 10) {
    numberStr = '00' + jumlah;
  } else if (jumlah < 100) {
    numberStr = '0' + jumlah;
  } else {
    numberStr = '' + jumlah;
  }

  id = prefix + randomString + numberStr;
  return id;
}

/**
 * POST /api/auth/register
 *
 * Function: insertDataAgent
 * Endpoint: /api/auth/register
 *
 * Body request:
 * {
 *   "name":       "Nigel Tjandra",
 *   "birthdate":  "2000-05-22",
 *   "phone":      "081234567890",
 *   "username":   "nigel",
 *   "password":   "rahasia123",
 *   "konfirmasi": "rahasia123",
 *   "privilege":  null,
 *   "createdBy":  "Self-Register"
 * }
 *
 * Response format (sesuai requirement):
 * {
 *   status: 200,
 *   data: {
 *     response: { user_id, name, username, ... },
 *     message: "Sukses register"
 *   },
 *   isSuccess: 1
 * }
 */
exports.insertDataAgent = async (req, res) => {
  const { name, birthdate, phone, username, password, konfirmasi, privilege, createdBy } = req.body;

  // Info request untuk log
  const requestInfo = {
    ip:    req.ip || req.connection?.remoteAddress || 'unknown',
    route: 'POST /api/auth/register'
  };

  // Validasi field wajib
  if (!name || !username || !password) {
    authLog.registerFailed('Field name, username, dan password wajib diisi', {
      ...requestInfo,
      'HTTP Status': HTTP.BAD_REQUEST,
      'Username Input': username || '(kosong)',
      'Name Input':     name || '(kosong)'
    });
    return sendError(res, HTTP.BAD_REQUEST, null,
      'Field name, username, dan password wajib diisi');
  }
  if (password !== konfirmasi) {
    authLog.registerFailed('Password dan Konfirmasi tidak cocok', {
      ...requestInfo,
      'HTTP Status': HTTP.BAD_REQUEST,
      'Username Input': username
    });
    return sendError(res, HTTP.BAD_REQUEST, null,
      'Password dan Konfirmasi tidak cocok');
  }
  if (String(password).length < 6) {
    authLog.registerFailed('Password kurang dari 6 karakter', {
      ...requestInfo,
      'HTTP Status': HTTP.BAD_REQUEST,
      'Username Input': username,
      'Password Length': String(password).length
    });
    return sendError(res, HTTP.BAD_REQUEST, null,
      'Password minimal 6 karakter');
  }

  try {
    // Cek username sudah dipakai atau belum
    const existingUser = await User.findOne({ where: { username: String(username).trim() } });
    if (existingUser) {
      authLog.registerFailed('Username sudah terpakai', {
        ...requestInfo,
        'HTTP Status': HTTP.CONFLICT,
        'Username Input': username,
        'Existing User ID': existingUser.user_id
      });
      return sendError(res, HTTP.CONFLICT, null,
        'Username sudah terpakai, silakan pilih yang lain');
    }

    // Hash password pakai bcrypt
    const saltRounds = getSaltRounds();
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate user_id (prefix nama + random + count+1)
    const totalUsers = await User.count();
    const newUserId = makeUserIdFunction(name, totalUsers);

    // Capitalize each word di nama
    const formattedName = String(name).trim()
      .replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());

    // Default created_by = 'Self-Register' kalau register dari halaman publik
    const createdByValue = (createdBy && String(createdBy).trim() !== '')
      ? String(createdBy).trim().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())
      : 'Self-Register';

    // Insert ke tabel users
    const newUser = await User.create({
      user_id:       newUserId,
      name:          formattedName,
      birthdate:     birthdate || null,
      phone:         phone ? String(phone).trim() : null,
      username:      String(username).trim(),
      password:      hashedPassword,
      refresh_token: null,
      updated_date:  null,
      update_by:     null,
      created_date:  new Date(),
      created_by:    createdByValue,
      status:        1,   // aktif by default
      privilege:     privilege || null
    });

    // Log SUCCESS ke terminal dalam bentuk box
    authLog.registerSuccess({
      user_id:  newUser.user_id,
      username: newUser.username,
      name:     newUser.name
    }, {
      ...requestInfo,
      'HTTP Status':  HTTP.CREATED,
      'Phone':        newUser.phone || '(kosong)',
      'Birthdate':    newUser.birthdate || '(kosong)',
      'Created By':   newUser.created_by,
      'Total Users':  totalUsers + 1
    });

    // Hilangkan password dari respon
    const safeUser = {
      id:           newUser.id,
      user_id:      newUser.user_id,
      name:         newUser.name,
      birthdate:    newUser.birthdate,
      phone:        newUser.phone,
      username:     newUser.username,
      status:       newUser.status,
      privilege:    newUser.privilege,
      created_date: newUser.created_date,
      created_by:   newUser.created_by
    };

    return sendSuccess(res, HTTP.CREATED, safeUser, 'Sukses register');
  } catch (error) {
    authLog.registerFailed('Server error: ' + (error.message || 'Unknown error'), {
      ...requestInfo,
      'HTTP Status': HTTP.INTERNAL_SERVER_ERROR,
      'Username Input': username,
      'Error Stack': error.stack ? error.stack.split('\n')[0] : ''
    });
    console.error('[REGISTER ERROR]', error);
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null,
      'Gagal register: ' + (error.message || 'Unknown error'));
  }
};

/**
 * GET /api/auth/users-count
 * Helper untuk frontend agar bisa preview format user_id yang akan dibuat.
 */
exports.countUsers = async (req, res) => {
  try {
    const total = await User.count();
    return sendSuccess(res, HTTP.OK, { total }, 'Jumlah user');
  } catch (error) {
    return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, error.message);
  }
};
