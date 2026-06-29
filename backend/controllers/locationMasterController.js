/**
 * locationMasterController.js
 *
 * CRUD controller untuk master lokasi rujukan properti.
 * Lokasi dipakai sebagai referensi tempat terdekat saat input/cari properti
 * (mis. Pasar Besar, PTC, Café, Kebun Binatang, Indomaret, Stasiun).
 *
 * location_id formula: prefix nama (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Pasar Besar" + 3 data → "PBAb3xK004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { Location } = require('../models');
const { HTTP }     = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

class LocationMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     PRIVATE HELPERS
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * Cari lokasi aktif dengan nama sama (case/spasi-insensitive).
   * excludeId dipakai saat update agar tidak mendeteksi dirinya sendiri sebagai duplikat.
   */
  static async #findDuplicate(name, excludeId = null) {
    const target = GeneralController.normalizeName(name);
    if (!target) return null;

    const where = { status: { [Op.ne]: 3 } };
    if (excludeId) where.location_id = { [Op.ne]: excludeId };

    const existing = await Location.findAll({ where, attributes: ['location_id', 'name'] });
    return existing.find(l => GeneralController.normalizeName(l.name) === target) || null;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SHOW DATA (list dengan pagination + search)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/location/list?page=1&search=
   * Auth: verifyToken
   */
  static async showDataLocation(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;
      const search   = req.query.search ? String(req.query.search).trim() : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search) where.name = { [Op.like]: `%${search}%` };

      const { count, rows } = await Location.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      const locations = rows.map((loc, index) => ({
        no:           offset + index + 1,
        id:           loc.id,
        location_id:  loc.location_id,
        name:         loc.name,
        status:       loc.status,
        status_label: loc.status === 1 ? 'Aktif' : 'Disabled',
        created_date: loc.created_date,
        created_by:   loc.created_by,
        updated_date: loc.updated_date,
        updated_by:   loc.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        locations,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data lokasi berhasil dimuat');

    } catch (error) {
      console.error('[LOCATION LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data lokasi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/location/detail/:location_id
   * Auth: verifyToken
   */
  static async getDetailLocation(req, res) {
    const { location_id } = req.params;
    try {
      const loc = await Location.findOne({ where: { location_id, status: { [Op.ne]: 3 } } });
      if (!loc) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Lokasi tidak ditemukan');
      }

      const creatorName = await GeneralController.resolveUserName(loc.created_by);
      const updaterName = await GeneralController.resolveUserName(loc.updated_by);

      return sendSuccess(res, HTTP.OK, {
        location: {
          id:              loc.id,
          location_id:     loc.location_id,
          name:            loc.name,
          status:          loc.status,
          status_label:    loc.status === 1 ? 'Aktif' : 'Disabled',
          created_date:    loc.created_date,
          created_by:      loc.created_by,
          created_by_name: creatorName,
          updated_date:    loc.updated_date,
          updated_by:      loc.updated_by,
          updated_by_name: updaterName
        }
      }, 'Detail lokasi berhasil dimuat');

    } catch (error) {
      console.error('[LOCATION DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail lokasi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/location/insert
   * Body: { name }
   * Auth: verifyToken
   */
  static async insertDataLocation(req, res) {
    const { name }   = req.body;
    const createdBy  = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama lokasi wajib diisi');
    }
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const duplicate = await LocationMasterController.#findDuplicate(name);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Lokasi "${String(name).trim()}" sudah terdaftar. Hindari data duplikat.`
        );
      }

      const total      = await Location.count();
      const idLocation = GeneralController.generateRandomId(name, total).toUpperCase();

      const newLoc = await Location.create({
        location_id:  idLocation,
        name:         String(name).trim().toUpperCase(),
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   String(createdBy).toUpperCase(),
        updated_date: null,
        updated_by:   null
      });

      console.log(`[LOCATION] ✅ INSERT — ${newLoc.location_id} | "${newLoc.name}" | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        location: {
          id:           newLoc.id,
          location_id:  newLoc.location_id,
          name:         newLoc.name,
          status:       newLoc.status,
          created_date: newLoc.created_date,
          created_by:   newLoc.created_by
        }
      }, 'Lokasi berhasil ditambahkan');

    } catch (error) {
      console.error('[LOCATION INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan lokasi: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/location/update/:location_id
   * Body: { name }
   * Auth: verifyToken
   */
  static async updateDataLocation(req, res) {
    const { location_id } = req.params;
    const { name }        = req.body;
    const updatedBy       = req.user?.userId || null;

    if (!location_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'location_id wajib disertakan');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama lokasi wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const loc = await Location.findOne({ where: { location_id, status: { [Op.ne]: 3 } } });
      if (!loc) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Lokasi tidak ditemukan');
      }

      const duplicate = await LocationMasterController.#findDuplicate(name, location_id);
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat dengan lokasi "${duplicate.name}". Pilih nama lain.`
        );
      }

      await loc.update({
        name:         String(name).trim().toUpperCase(),
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy.toUpperCase()
      });

      const creatorName = await GeneralController.resolveUserName(loc.created_by);
      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[LOCATION] ✏️  UPDATE — ${loc.location_id} | "${loc.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        location: {
          id:              loc.id,
          location_id:     loc.location_id,
          name:            loc.name,
          status:          loc.status,
          created_date:    loc.created_date,
          created_by:      loc.created_by,
          created_by_name: creatorName,
          updated_date:    loc.updated_date,
          updated_by:      loc.updated_by,
          updated_by_name: updaterName
        }
      }, 'Lokasi berhasil diperbarui');

    } catch (error) {
      console.error('[LOCATION UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui lokasi: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/location/toggle-status/:location_id
   * Auth: verifyToken
   */
  static async toggleStatusLocation(req, res) {
    const { location_id } = req.params;
    const updatedBy       = req.user?.userId || null;

    try {
      const loc = await Location.findOne({ where: { location_id, status: { [Op.ne]: 3 } } });
      if (!loc) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Lokasi tidak ditemukan');
      }

      const newStatus = loc.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await loc.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy ? updatedBy.toUpperCase() : null
      });

      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[LOCATION] 🔄 TOGGLE — ${loc.location_id} | "${loc.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        location: {
          id:              loc.id,
          location_id:     loc.location_id,
          name:            loc.name,
          status:          newStatus,
          status_label:    label,
          created_date:    loc.created_date,
          created_by:      loc.created_by,
          created_by_name: await GeneralController.resolveUserName(loc.created_by),
          updated_date:    loc.updated_date,
          updated_by:      loc.updated_by,
          updated_by_name: updaterName
        }
      }, `Lokasi "${loc.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[LOCATION TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status lokasi');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/location/delete/:location_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteDataLocation(req, res) {
    const { location_id } = req.params;
    const updatedBy       = req.user?.userId || null;

    try {
      const loc = await Location.findOne({ where: { location_id, status: { [Op.ne]: 3 } } });
      if (!loc) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Lokasi tidak ditemukan atau sudah dihapus');
      }

      await loc.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[LOCATION] 🗑️  DELETE — ${loc.location_id} | "${loc.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        location_id: loc.location_id,
        name:        loc.name
      }, `Lokasi "${loc.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[LOCATION DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus lokasi');
    }
  }
}

module.exports = LocationMasterController;
