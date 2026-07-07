'use strict';

/**
 * GeneralController.js
 *
 * Base controller — analog of PHP GeneralController.php.
 * Semua master controller extends class ini agar tidak ada duplikasi logika.
 *
 * Inheritance chain (JS):
 *   GeneralController
 *     ├── CityMasterController
 *     ├── CountryMasterController
 *     ├── ProvinceMasterController
 *     ├── FacilityMasterController
 *     ├── LocationMasterController
 *     ├── PropertyMasterController
 *     └── RegisterController
 *
 * Algorithm generateRandomId() mirrors PHP:
 *   public function generateRandomString($length = 3, $nama, $digitData)
 *   – prefix  : huruf pertama kata-pertama + huruf pertama kata-terakhir (2 char)
 *   – random  : alphanumeric acak sepanjang `length` (default 5)
 *   – counter : count+1 padded ke 3 digit
 */

const { Op } = require('sequelize');
const { User } = require('../models');

class GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     ID GENERATOR — satu-satunya implementasi kanonik
     Menggantikan static #randomString + static #makeXxxId yang duplikat
     di setiap master controller.
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * Generate record ID dengan format:
   *   [prefix 2 char] + [random alphanumeric `length` char] + [count+1 padded 3 digit]
   *
   * @param {string} name    Nama entitas (diambil prefix-nya)
   * @param {number} count   Jumlah record saat ini (bukan +1 — fungsi ini yang tambah 1)
   * @param {number} length  Panjang bagian random (default 5)
   * @returns {string}       ID uppercase, e.g. "SUAb3xK004"
   *
   * Contoh:
   *   generateRandomId('Surabaya', 3)          → "SU<rand>004"
   *   generateRandomId('Jawa Timur', 3)        → "JT<rand>004"
   *   generateRandomId('Kolam Renang', 9, 5)   → "KR<rand>010"
   */
  static generateRandomId(name, count, length = 5) {
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let   random = '';
    for (let i = 0; i < length; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const cleanName = String(name || '').trim();
    const parts     = cleanName.split(/\s+/);
    let   prefix;

    if (parts.length < 2) {
      prefix = (cleanName[0] || 'G').toUpperCase() + (cleanName[1] || 'X').toUpperCase();
    } else {
      prefix = parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }

    const total     = count + 1;
    const numberStr = total < 10 ? `00${total}` : total < 100 ? `0${total}` : `${total}`;

    return (prefix + random + numberStr).toUpperCase();
  }

  /* ──────────────────────────────────────────────────────────────────────────
    SHARED HELPERS — dulunya duplikat di setiap controller
  ────────────────────────────────────────────────────────────────────────── */

  /** Baca PAGINATION_ROWS dari .env (default 10, minimum 1). */
  static pageSize() {
    const raw    = String(process.env.PAGINATION_ROWS || '10').trim().replace(/[;\s]+$/g, '');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 10;
  }

  /** Tanggal hari ini format YYYY-MM-DD. */
  static todayDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Normalisasi nama untuk perbandingan duplikat:
   * huruf kecil → spasi ganda dirapikan → trim.
   * "Jawa  Timur " → "jawa timur"
   */
  static normalizeName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Resolve user_id ke nama user untuk tampil di UI.
   * Mengembalikan userId itu sendiri bila user tidak ditemukan.
   */
  static async resolveUserName(userId) {
    if (!userId) return null;
    try {
      const user = await User.findOne({ where: { user_id: userId }, attributes: ['name'] });
      return user ? user.name : userId;
    } catch (_) {
      return userId;
    }
  }

  /**
   * Ambil `name` sebuah record berdasarkan kolom id string-nya (untuk join
   * tampilan). Menggantikan helper #countryName/#provinceName yang duplikat
   * di setiap controller.
   *
   * @param {import('sequelize').ModelStatic} model  Model Sequelize (Country/Province/…)
   * @param {string} idField  Nama kolom id (mis. 'country_id', 'province_id')
   * @param {string} id       Nilai id yang dicari
   * @returns {Promise<string|null>} nama record, atau null bila tidak ada/error
   */
  static async lookupName(model, idField, id) {
    if (!id) return null;
    try {
      const row = await model.findOne({ where: { [idField]: id }, attributes: ['name'] });
      return row ? row.name : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Cari record aktif (status ≠ 3) dengan nama sama (case/spasi-insensitive),
   * dalam scope opsional. Satu implementasi kanonik yang menggantikan
   * #findDuplicate yang sebelumnya diduplikat di controller Country, Location,
   * Province, dan City — bedanya hanya model, kolom id, dan scope-nya.
   *
   * @param {import('sequelize').ModelStatic} model  Model yang dicek (Country/Location/Province/City)
   * @param {string} name  Nama yang akan divalidasi keunikannya
   * @param {object} opts
   * @param {string} opts.idField    Nama kolom id string (mis. 'country_id', 'city_id')
   * @param {object} [opts.scope]    Filter tambahan penentu cakupan unik
   *                                 (mis. { country_id } untuk provinsi, { province_id } untuk kota)
   * @param {string|null} [opts.excludeId]  Nilai idField yang dikecualikan (untuk update)
   * @returns {Promise<object|null>} Record existing yang bentrok, atau null
   */
  static async findDuplicateName(model, name, { idField, scope = {}, excludeId = null } = {}) {
    const target = GeneralController.normalizeName(name);
    if (!target) return null;

    const where = { ...scope, status: { [Op.ne]: 3 } };
    if (excludeId) where[idField] = { [Op.ne]: excludeId };

    const rows = await model.findAll({ where, attributes: [idField, 'name'] });
    return rows.find(r => GeneralController.normalizeName(r.name) === target) || null;
  }
}

module.exports = GeneralController;
