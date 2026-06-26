/**
 * provinceMasterController.js
 *
 * CRUD controller untuk master provinsi (Province).
 * Terhubung ke negara via country_id.
 *
 * province_id formula: prefix nama (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Jawa Timur" + 3 data → "JTAb3xK004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { Province, Country, User } = require('../models');
const { HTTP }           = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');

class ProvinceMasterController {

  /* ──────────────────────────────────────────────────────────────────────────
     PRIVATE HELPERS
  ────────────────────────────────────────────────────────────────────────── */

  static #randomString(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result  = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static #makeProvinceId(name, count) {
    const cleanName = String(name || '').trim();
    const parts     = cleanName.split(/\s+/);
    let prefix;

    if (parts.length < 2) {
      prefix = (cleanName[0] || 'P').toUpperCase() + (cleanName[1] || 'A').toUpperCase();
    } else {
      prefix = parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }

    const random    = ProvinceMasterController.#randomString(5);
    const total     = count + 1;
    const numberStr = total < 10 ? `00${total}` : total < 100 ? `0${total}` : `${total}`;

    return prefix + random + numberStr;
  }

  static #pageSize() {
    const raw    = String(process.env.PAGINATION_ROWS || '10').trim().replace(/[;\s]+$/g, '');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 10;
  }

  static async #resolveUserName(userId) {
    if (!userId) return null;
    try {
      const user = await User.findOne({ where: { user_id: userId }, attributes: ['name'] });
      return user ? user.name : userId;
    } catch (_) {
      return userId;
    }
  }

  static #todayDate() {
    return new Date().toISOString().split('T')[0];
  }

  static #normalizeName(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /** Ambil nama negara dari country_id (untuk join tampilan list/detail). */
  static async #countryName(idCountry) {
    if (!idCountry) return null;
    try {
      const c = await Country.findOne({ where: { country_id: idCountry }, attributes: ['name'] });
      return c ? c.name : null;
    } catch (_) {
      return null;
    }
  }

  /** Validasi negara induk ada & aktif (status ≠ 3). */
  static async #countryExists(idCountry) {
    const c = await Country.findOne({ where: { country_id: idCountry, status: { [Op.ne]: 3 } } });
    return !!c;
  }

  /**
   * Cari provinsi aktif dengan nama sama DALAM negara yang sama (case/spasi-insensitive).
   * Nama provinsi unik per-negara, bukan global.
   */
  static async #findDuplicate(name, idCountry, excludeId = null) {
    const target = ProvinceMasterController.#normalizeName(name);
    if (!target) return null;

    const where = { country_id: idCountry, status: { [Op.ne]: 3 } };
    if (excludeId) where.province_id = { [Op.ne]: excludeId };

    const existing = await Province.findAll({ where, attributes: ['province_id', 'name'] });
    return existing.find(p => ProvinceMasterController.#normalizeName(p.name) === target) || null;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/province/insert
   * Body: { country_id, name }
   * Auth: verifyToken
   */
  static async insertDataProvince(req, res) {
    const { country_id, name } = req.body;
    const createdBy = req.user?.userId || null;

    if (!country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Negara wajib dipilih');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama provinsi wajib diisi');
    }
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      if (!(await ProvinceMasterController.#countryExists(country_id))) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'Negara yang dipilih tidak ditemukan');
      }

      const duplicate = await ProvinceMasterController.#findDuplicate(name, country_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Provinsi "${String(name).trim()}" sudah terdaftar di negara ini. Hindari data duplikat.`
        );
      }

      const total      = await Province.count();
      const idProvince = ProvinceMasterController.#makeProvinceId(name, total).toUpperCase();

      const newProvince = await Province.create({
        province_id:  idProvince.toUpperCase(),
        country_id:   String(country_id).toUpperCase(),
        name:         String(name).trim().toUpperCase(),
        status:       1,
        created_date: ProvinceMasterController.#todayDate(),
        created_by:   String(createdBy).toUpperCase(),
        updated_date: null,
        updated_by:   null
      });

      console.log(`[PROVINCE] ✅ INSERT — ${newProvince.province_id} | "${newProvince.name}" | Country: ${newProvince.country_id} | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        province: {
          id:           newProvince.id,
          province_id:  newProvince.province_id,
          country_id:   newProvince.country_id,
          name:         newProvince.name,
          status:       newProvince.status,
          created_date: newProvince.created_date,
          created_by:   newProvince.created_by
        }
      }, 'Provinsi berhasil ditambahkan');

    } catch (error) {
      console.error('[PROVINCE INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan provinsi: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/province/update/:province_id
   * Body: { country_id, name }
   * Auth: verifyToken
   */
  static async updateDataProvince(req, res) {
    const { province_id } = req.params;
    const { country_id, name } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!province_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'province_id wajib disertakan');
    }
    if (!country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Negara wajib dipilih');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama provinsi wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const province = await Province.findOne({ where: { province_id, status: { [Op.ne]: 3 } } });
      if (!province) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Provinsi tidak ditemukan');
      }

      if (!(await ProvinceMasterController.#countryExists(country_id))) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'Negara yang dipilih tidak ditemukan');
      }

      const duplicate = await ProvinceMasterController.#findDuplicate(name, country_id, province_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat dengan provinsi "${duplicate.name}" di negara ini. Pilih nama lain.`
        );
      }

      await province.update({
        country_id:   country_id.toUpperCase(),
        name:         String(name).trim().toUpperCase(),
        updated_date: ProvinceMasterController.#todayDate(),
        updated_by:   updatedBy.toUpperCase()
      });

      const creatorName = await ProvinceMasterController.#resolveUserName(province.created_by);
      const updaterName = await ProvinceMasterController.#resolveUserName(updatedBy);
      const countryName = await ProvinceMasterController.#countryName(province.country_id);

      console.log(`[PROVINCE] ✏️  UPDATE — ${province.province_id} | "${province.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        province: {
          id:              province.id,
          province_id:     province.province_id,
          country_id:      province.country_id,
          country_name:    countryName,
          name:            province.name,
          status:          province.status,
          created_date:    province.created_date,
          created_by:      province.created_by,
          created_by_name: creatorName,
          updated_date:    province.updated_date,
          updated_by:      province.updated_by,
          updated_by_name: updaterName
        }
      }, 'Provinsi berhasil diperbarui');

    } catch (error) {
      console.error('[PROVINCE UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui provinsi: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination + nama negara hasil join)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/province/list?page=1&search=&country_id=
   * Auth: verifyToken
   */
  static async showDataProvince(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = ProvinceMasterController.#pageSize();
      const offset   = (page - 1) * pageSize;
      const search   = req.query.search ? String(req.query.search).trim() : '';
      const idCountry = req.query.country_id ? String(req.query.country_id).trim() : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search)    where.name       = { [Op.like]: `%${search}%` };
      if (idCountry) where.country_id = idCountry;

      const { count, rows } = await Province.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      // Map country_id → name dalam satu query (hindari N+1)
      const countryIds = [...new Set(rows.map(r => r.country_id).filter(Boolean))];
      const countryRows = countryIds.length
        ? await Country.findAll({ where: { country_id: { [Op.in]: countryIds } }, attributes: ['country_id', 'name'] })
        : [];
      const countryMap = Object.fromEntries(countryRows.map(c => [c.country_id, c.name]));

      const provinces = rows.map((p, index) => ({
        no:           offset + index + 1,
        id:           p.id,
        province_id:  p.province_id,
        country_id:   p.country_id,
        country_name: countryMap[p.country_id] || '-',
        name:         p.name,
        status:       p.status,
        status_label: p.status === 1 ? 'Aktif' : 'Disabled',
        created_date: p.created_date,
        created_by:   p.created_by,
        updated_date: p.updated_date,
        updated_by:   p.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        provinces,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data provinsi berhasil dimuat');

    } catch (error) {
      console.error('[PROVINCE LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data provinsi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/province/detail/:province_id
   * Auth: verifyToken
   */
  static async getDetailProvince(req, res) {
    const { province_id } = req.params;
    try {
      const province = await Province.findOne({ where: { province_id, status: { [Op.ne]: 3 } } });
      if (!province) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Provinsi tidak ditemukan');
      }

      const creatorName = await ProvinceMasterController.#resolveUserName(province.created_by);
      const updaterName = await ProvinceMasterController.#resolveUserName(province.updated_by);
      const countryName = await ProvinceMasterController.#countryName(province.country_id);

      return sendSuccess(res, HTTP.OK, {
        province: {
          id:              province.id,
          province_id:     province.province_id,
          country_id:      province.country_id,
          country_name:    countryName,
          name:            province.name,
          status:          province.status,
          status_label:    province.status === 1 ? 'Aktif' : 'Disabled',
          created_date:    province.created_date,
          created_by:      province.created_by,
          created_by_name: creatorName,
          updated_date:    province.updated_date,
          updated_by:      province.updated_by,
          updated_by_name: updaterName
        }
      }, 'Detail provinsi berhasil dimuat');

    } catch (error) {
      console.error('[PROVINCE DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail provinsi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     OPTIONS (dropdown parent untuk City — bisa difilter by negara)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/province/options?country_id=
   * Auth: verifyToken
   */
  static async getProvinceOptions(req, res) {
    try {
      const idCountry = req.query.country_id ? String(req.query.country_id).trim() : '';

      const where = { status: 1 };
      if (idCountry) where.country_id = idCountry;

      const rows = await Province.findAll({
        where,
        order:      [['name', 'ASC']],
        attributes: ['province_id', 'country_id', 'name']
      });

      const provinces = rows.map(p => ({ province_id: p.province_id, country_id: p.country_id, name: p.name }));
      return sendSuccess(res, HTTP.OK, { provinces }, 'Opsi provinsi berhasil dimuat');

    } catch (error) {
      console.error('[PROVINCE OPTIONS ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat opsi provinsi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/province/toggle-status/:province_id
   * Auth: verifyToken
   */
  static async toggleStatusProvince(req, res) {
    const { province_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const province = await Province.findOne({ where: { province_id, status: { [Op.ne]: 3 } } });
      if (!province) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Provinsi tidak ditemukan');
      }

      const newStatus = province.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await province.update({
        status:       newStatus,
        updated_date: ProvinceMasterController.#todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[PROVINCE] 🔄 TOGGLE — ${province.province_id} | "${province.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        province_id:  province.province_id,
        name:         province.name,
        status:       newStatus,
        status_label: label
      }, `Provinsi "${province.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[PROVINCE TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status provinsi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/province/delete/:province_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteProvince(req, res) {
    const { province_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const province = await Province.findOne({ where: { province_id, status: { [Op.ne]: 3 } } });
      if (!province) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Provinsi tidak ditemukan atau sudah dihapus');
      }

      await province.update({
        status:       3,
        updated_date: ProvinceMasterController.#todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[PROVINCE] 🗑️  DELETE — ${province.province_id} | "${province.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        province_id: province.province_id,
        name:        province.name
      }, `Provinsi "${province.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[PROVINCE DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus provinsi');
    }
  }
}

module.exports = ProvinceMasterController;
