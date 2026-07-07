/**
 * cityMasterController.js
 *
 * CRUD controller untuk master kota (City).
 * Terhubung ke provinsi via province_id dan negara via country_id.
 *
 * city_id formula: prefix nama (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Surabaya" + 3 data → "SUAb3xK004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { City, Province, Country } = require('../models');
const { HTTP }           = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');
const { invalidateCache: invalidateAICache } = require('../services/aiContextService');

class CityMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     PRIVATE HELPERS — hanya yang unik untuk city
  ────────────────────────────────────────────────────────────────────────── */

  static #countryName(idCountry) {
    return GeneralController.lookupName(Country, 'country_id', idCountry);
  }

  static #provinceName(idProvince) {
    return GeneralController.lookupName(Province, 'province_id', idProvince);
  }

  /**
   * Validasi provinsi induk ada & aktif, dan benar-benar milik country_id.
   * Mengembalikan record provinsi bila valid, atau null.
   */
  static async #validProvince(idProvince, idCountry) {
    const p = await Province.findOne({ where: { province_id: idProvince, status: { [Op.ne]: 3 } } });
    if (!p) return null;
    if (idCountry && String(p.country_id) !== String(idCountry)) return null;
    return p;
  }

  /**
   * Cari kota duplikat DALAM provinsi yang sama (nama kota unik per-provinsi).
   * Delegasi ke GeneralController dengan scope province_id.
   */
  static #findDuplicate(name, idProvince, excludeId = null) {
    return GeneralController.findDuplicateName(City, name, {
      idField: 'city_id',
      scope:   { province_id: idProvince },
      excludeId
    });
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/city/insert
   * Body: { country_id, province_id, name }
   * Auth: verifyToken
   */
  static async insertDataCity(req, res) {
    const { country_id, province_id, name } = req.body;
    const createdBy = req.user?.userId || null;

    if (!country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Negara wajib dipilih');
    }
    if (!province_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi wajib dipilih');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama kota wajib diisi');
    }
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const province = await CityMasterController.#validProvince(province_id, country_id);
      if (!province) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi yang dipilih tidak valid untuk negara tersebut');
      }

      const duplicate = await CityMasterController.#findDuplicate(name, province_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Kota "${String(name).trim()}" sudah terdaftar di provinsi ini. Hindari data duplikat.`
        );
      }

      const total  = await City.count();
      const idCity = GeneralController.generateRandomId(name, total).toUpperCase();

      const newCity = await City.create({
        city_id:      idCity,
        province_id:  String(province_id).toUpperCase(),
        country_id:   String(country_id).toUpperCase(),
        name:         String(name).trim().toUpperCase(),
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   String(createdBy).toUpperCase(),
        updated_date: null,
        updated_by:   null
      });

      console.log(`[CITY] ✅ INSERT — ${newCity.city_id} | "${newCity.name}" | Province: ${newCity.province_id} | By: ${createdBy}`);
      invalidateAICache();

      return sendSuccess(res, HTTP.CREATED, {
        city: {
          id:           newCity.id,
          city_id:      newCity.city_id,
          province_id:  newCity.province_id,
          country_id:   newCity.country_id,
          name:         newCity.name,
          status:       newCity.status,
          created_date: newCity.created_date,
          created_by:   newCity.created_by
        }
      }, 'Kota berhasil ditambahkan');

    } catch (error) {
      console.error('[CITY INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan kota: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/city/update/:city_id
   * Body: { country_id, province_id, name }
   * Auth: verifyToken
   */
  static async updateDataCity(req, res) {
    const { city_id } = req.params;
    const { country_id, province_id, name } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!city_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'city_id wajib disertakan');
    }
    if (!country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Negara wajib dipilih');
    }
    if (!province_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi wajib dipilih');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama kota wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const city = await City.findOne({ where: { city_id, status: { [Op.ne]: 3 } } });
      if (!city) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Kota tidak ditemukan');
      }

      const province = await CityMasterController.#validProvince(province_id, country_id);
      if (!province) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi yang dipilih tidak valid untuk negara tersebut');
      }

      const duplicate = await CityMasterController.#findDuplicate(name, province_id, city_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat dengan kota "${duplicate.name}" di provinsi ini. Pilih nama lain.`
        );
      }

      await city.update({
        country_id:   country_id.toUpperCase(),
        province_id:  province_id.toUpperCase(),
        name:         String(name).trim().toUpperCase(),
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy.toUpperCase()
      });

      const creatorName  = await GeneralController.resolveUserName(city.created_by);
      const updaterName  = await GeneralController.resolveUserName(updatedBy);
      const provinceName = await CityMasterController.#provinceName(city.province_id);
      const countryName  = await CityMasterController.#countryName(city.country_id);

      console.log(`[CITY] ✏️  UPDATE — ${city.city_id} | "${city.name}" | By: ${updatedBy}`);
      invalidateAICache();

      return sendSuccess(res, HTTP.OK, {
        city: {
          id:              city.id,
          city_id:         city.city_id,
          province_id:     city.province_id,
          province_name:   provinceName,
          country_id:      city.country_id,
          country_name:    countryName,
          name:            city.name,
          status:          city.status,
          created_date:    city.created_date,
          created_by:      city.created_by,
          created_by_name: creatorName,
          updated_date:    city.updated_date,
          updated_by:      city.updated_by,
          updated_by_name: updaterName
        }
      }, 'Kota berhasil diperbarui');

    } catch (error) {
      console.error('[CITY UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui kota: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination + nama provinsi & negara hasil join)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/city/list?page=1&search=&country_id=&province_id=
   * Auth: verifyToken
   */
  static async showDataCity(req, res) {
    try {
      const page      = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize  = GeneralController.pageSize();
      const offset    = (page - 1) * pageSize;
      const search    = req.query.search      ? String(req.query.search).trim()      : '';
      const idCountry = req.query.country_id  ? String(req.query.country_id).trim()  : '';
      const idProvince = req.query.province_id ? String(req.query.province_id).trim() : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search)     where.name        = { [Op.like]: `%${search}%` };
      if (idCountry)  where.country_id  = idCountry;
      if (idProvince) where.province_id = idProvince;

      const { count, rows } = await City.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      // Resolve nama provinsi & negara dalam batch (hindari N+1)
      const provinceIds = [...new Set(rows.map(r => r.province_id).filter(Boolean))];
      const countryIds  = [...new Set(rows.map(r => r.country_id).filter(Boolean))];

      const provinceRows = provinceIds.length
        ? await Province.findAll({ where: { province_id: { [Op.in]: provinceIds } }, attributes: ['province_id', 'name'] })
        : [];
      const countryRows = countryIds.length
        ? await Country.findAll({ where: { country_id: { [Op.in]: countryIds } }, attributes: ['country_id', 'name'] })
        : [];

      const provinceMap = Object.fromEntries(provinceRows.map(p => [p.province_id, p.name]));
      const countryMap  = Object.fromEntries(countryRows.map(c => [c.country_id, c.name]));

      const cities = rows.map((c, index) => ({
        no:            offset + index + 1,
        id:            c.id,
        city_id:       c.city_id,
        province_id:   c.province_id,
        province_name: provinceMap[c.province_id] || '-',
        country_id:    c.country_id,
        country_name:  countryMap[c.country_id] || '-',
        name:          c.name,
        status:        c.status,
        status_label:  c.status === 1 ? 'Aktif' : 'Disabled',
        created_date:  c.created_date,
        created_by:    c.created_by,
        updated_date:  c.updated_date,
        updated_by:    c.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        cities,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data kota berhasil dimuat');

    } catch (error) {
      console.error('[CITY LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data kota');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/city/detail/:city_id
   * Auth: verifyToken
   */
  static async getDetailCity(req, res) {
    const { city_id } = req.params;
    try {
      const city = await City.findOne({ where: { city_id, status: { [Op.ne]: 3 } } });
      if (!city) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Kota tidak ditemukan');
      }

      const creatorName  = await GeneralController.resolveUserName(city.created_by);
      const updaterName  = await GeneralController.resolveUserName(city.updated_by);
      const provinceName = await CityMasterController.#provinceName(city.province_id);
      const countryName  = await CityMasterController.#countryName(city.country_id);

      return sendSuccess(res, HTTP.OK, {
        city: {
          id:              city.id,
          city_id:         city.city_id,
          province_id:     city.province_id,
          province_name:   provinceName,
          country_id:      city.country_id,
          country_name:    countryName,
          name:            city.name,
          status:          city.status,
          status_label:    city.status === 1 ? 'Aktif' : 'Disabled',
          created_date:    city.created_date,
          created_by:      city.created_by,
          created_by_name: creatorName,
          updated_date:    city.updated_date,
          updated_by:      city.updated_by,
          updated_by_name: updaterName
        }
      }, 'Detail kota berhasil dimuat');

    } catch (error) {
      console.error('[CITY DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail kota');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/city/toggle-status/:city_id
   * Auth: verifyToken
   */
  static async toggleStatusCity(req, res) {
    const { city_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const city = await City.findOne({ where: { city_id, status: { [Op.ne]: 3 } } });
      if (!city) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Kota tidak ditemukan');
      }

      const newStatus = city.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await city.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy.toUpperCase()
      });

      const updaterName  = await GeneralController.resolveUserName(updatedBy);
      const provinceName = await CityMasterController.#provinceName(city.province_id);
      const countryName  = await CityMasterController.#countryName(city.country_id);

      console.log(`[CITY] 🔄 TOGGLE — ${city.city_id} | "${city.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        city: {
          id:              city.id,
          city_id:         city.city_id,
          province_id:     city.province_id,
          province_name:   provinceName,
          country_id:      city.country_id,
          country_name:    countryName,
          name:            city.name,
          status:          newStatus,
          status_label:    label,
          created_date:    city.created_date,
          created_by:      city.created_by,
          created_by_name: await GeneralController.resolveUserName(city.created_by),
          updated_date:    city.updated_date,
          updated_by:      city.updated_by,
          updated_by_name: updaterName
        }
      }, `Kota "${city.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[CITY TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status kota');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/city/delete/:city_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteCity(req, res) {
    const { city_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const city = await City.findOne({ where: { city_id, status: { [Op.ne]: 3 } } });
      if (!city) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Kota tidak ditemukan atau sudah dihapus');
      }

      await city.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[CITY] 🗑️  DELETE — ${city.city_id} | "${city.name}" | By: ${updatedBy}`);
      invalidateAICache();

      return sendSuccess(res, HTTP.OK, {
        city_id: city.city_id,
        name:    city.name
      }, `Kota "${city.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[CITY DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus kota');
    }
  }
}

module.exports = CityMasterController;
