/**
 * countryMasterController.js
 *
 * CRUD controller untuk master negara (Country).
 *
 * country_id formula: prefix nama (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Indonesia" + 3 data → "INAb3xK004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { Country } = require('../models');
const { HTTP }    = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

class CountryMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     Cek duplikat nama negara (global) — delegasi ke GeneralController.
  ────────────────────────────────────────────────────────────────────────── */
  static #findDuplicate(name, excludeId = null) {
    return GeneralController.findDuplicateName(Country, name, { idField: 'country_id', excludeId });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/country/insert
   * Body: { name }
   * Auth: verifyToken (req.user.userId = user_id pembuat)
   */
  static async insertDataCountry(req, res) {
    const { name } = req.body;
    const createdBy = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama negara wajib diisi');
    }
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const duplicate = await CountryMasterController.#findDuplicate(name);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Negara "${String(name).trim()}" sudah terdaftar. Gunakan data yang sudah ada untuk menghindari duplikasi.`
        );
      }

      const total     = await Country.count();
      const idCountry = GeneralController.generateRandomId(name, total).toUpperCase();

      const newCountry = await Country.create({
        country_id:   idCountry,
        name:         String(name).trim().toUpperCase(),
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   String(createdBy).toUpperCase(),
        updated_date: null,
        updated_by:   null
      });

      console.log(`[COUNTRY] ✅ INSERT — ${newCountry.country_id} | "${newCountry.name}" | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        country: {
          id:           newCountry.id,
          country_id:   newCountry.country_id,
          name:         newCountry.name,
          status:       newCountry.status,
          created_date: newCountry.created_date,
          created_by:   newCountry.created_by
        }
      }, 'Negara berhasil ditambahkan');

    } catch (error) {
      console.error('[COUNTRY INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan negara: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/country/update/:country_id
   * Body: { name }
   * Auth: verifyToken
   */
  static async updateDataCountry(req, res) {
    const { country_id } = req.params;
    const { name } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'country_id wajib disertakan');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama negara wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const country = await Country.findOne({ where: { country_id, status: { [Op.ne]: 3 } } });
      if (!country) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Negara tidak ditemukan');
      }

      const duplicate = await CountryMasterController.#findDuplicate(name, country_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat dengan negara "${duplicate.name}". Pilih nama lain.`
        );
      }

      await country.update({
        name:         String(name).trim().toUpperCase(),
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy ? updatedBy.toUpperCase() : null
      });

      const creatorName = await GeneralController.resolveUserName(country.created_by);
      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[COUNTRY] ✏️  UPDATE — ${country.country_id} | "${country.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        country: {
          id:              country.id,
          country_id:      country.country_id,
          name:            country.name,
          status:          country.status,
          created_date:    country.created_date,
          created_by:      country.created_by,
          created_by_name: creatorName,
          updated_date:    country.updated_date,
          updated_by:      country.updated_by,
          updated_by_name: updaterName
        }
      }, 'Negara berhasil diperbarui');

    } catch (error) {
      console.error('[COUNTRY UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui negara: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/country/list?page=1&search=
   * Menampilkan negara status 1 dan 2 (exclude deleted/status=3)
   * Auth: verifyToken
   */
  static async showDataCountry(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;
      const search   = req.query.search ? String(req.query.search).trim() : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search) where.name = { [Op.like]: `%${search}%` };

      const { count, rows } = await Country.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      const countries = rows.map((c, index) => ({
        no:           offset + index + 1,
        id:           c.id,
        country_id:   c.country_id,
        name:         c.name,
        status:       c.status,
        status_label: c.status === 1 ? 'Aktif' : 'Disabled',
        created_date: c.created_date,
        created_by:   c.created_by,
        updated_date: c.updated_date,
        updated_by:   c.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        countries,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data negara berhasil dimuat');

    } catch (error) {
      console.error('[COUNTRY LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data negara');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/country/detail/:country_id
   * Auth: verifyToken
   */
  static async getDetailCountry(req, res) {
    const { country_id } = req.params;
    try {
      const country = await Country.findOne({ where: { country_id, status: { [Op.ne]: 3 } } });
      if (!country) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Negara tidak ditemukan');
      }

      const creatorName = await GeneralController.resolveUserName(country.created_by);
      const updaterName = await GeneralController.resolveUserName(country.updated_by);

      return sendSuccess(res, HTTP.OK, {
        country: {
          id:              country.id,
          country_id:      country.country_id,
          name:            country.name,
          status:          country.status,
          status_label:    country.status === 1 ? 'Aktif' : 'Disabled',
          created_date:    country.created_date,
          created_by:      country.created_by,
          created_by_name: creatorName,
          updated_date:    country.updated_date,
          updated_by:      country.updated_by,
          updated_by_name: updaterName
        }
      }, 'Detail negara berhasil dimuat');

    } catch (error) {
      console.error('[COUNTRY DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail negara');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     OPTIONS (dropdown parent untuk Province/City — hanya status aktif)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/country/options
   * Auth: verifyToken
   */
  static async getCountryOptions(req, res) {
    try {
      const rows = await Country.findAll({
        where:      { status: 1 },
        order:      [['name', 'ASC']],
        attributes: ['country_id', 'name']
      });

      const countries = rows.map(c => ({ country_id: c.country_id, name: c.name }));
      return sendSuccess(res, HTTP.OK, { countries }, 'Opsi negara berhasil dimuat');

    } catch (error) {
      console.error('[COUNTRY OPTIONS ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat opsi negara');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/country/toggle-status/:country_id
   * Auth: verifyToken
   */
  static async toggleStatusCountry(req, res) {
    const { country_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const country = await Country.findOne({ where: { country_id, status: { [Op.ne]: 3 } } });
      if (!country) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Negara tidak ditemukan');
      }

      const newStatus = country.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await country.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy ? updatedBy.toUpperCase() : null
      });

      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[COUNTRY] 🔄 TOGGLE — ${country.country_id} | "${country.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        country: {
          id:              country.id,
          country_id:      country.country_id,
          name:            country.name,
          status:          newStatus,
          status_label:    label,
          created_date:    country.created_date,
          created_by:      country.created_by,
          created_by_name: await GeneralController.resolveUserName(country.created_by),
          updated_date:    country.updated_date,
          updated_by:      country.updated_by,
          updated_by_name: updaterName
        }
      }, `Negara "${country.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[COUNTRY TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status negara');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/country/delete/:country_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteCountry(req, res) {
    const { country_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const country = await Country.findOne({ where: { country_id, status: { [Op.ne]: 3 } } });
      if (!country) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Negara tidak ditemukan atau sudah dihapus');
      }

      await country.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[COUNTRY] 🗑️  DELETE — ${country.country_id} | "${country.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        country_id: country.country_id,
        name:       country.name
      }, `Negara "${country.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[COUNTRY DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus negara');
    }
  }
}

module.exports = CountryMasterController;
