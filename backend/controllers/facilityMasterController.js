/**
 * facilityMasterController.js
 *
 * CRUD controller untuk master fasilitas properti.
 *
 * facility_id formula: prefix nama (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Kolam Renang" + 3 data → "KRAb3x004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 */

const { Op } = require('sequelize');
const { Facility, User } = require('../models');
const { HTTP }           = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');

class FacilityMasterController {

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

  /**
   * Generate facility_id: [prefix 2 huruf] + [random 5 char] + [count+1 padded 3 digit]
   * e.g. "Kolam Renang" + 3 existing → "KRAb3xK004"
   */
  static #makeFacilityId(name, count) {
    const cleanName = String(name || '').trim();
    const parts     = cleanName.split(/\s+/);
    let prefix;

    if (parts.length < 2) {
      prefix = (cleanName[0] || 'F').toUpperCase() + (cleanName[1] || 'A').toUpperCase();
    } else {
      prefix = parts[0][0].toUpperCase() + parts[parts.length - 1][0].toUpperCase();
    }

    const random    = FacilityMasterController.#randomString(5);
    const total     = count + 1;
    const numberStr = total < 10 ? `00${total}` : total < 100 ? `0${total}` : `${total}`;

    return prefix + random + numberStr;
  }

  /**
   * Baca PAGINATION_ROWS dari .env (default 10, minimum 1)
   */
  static #pageSize() {
    const raw    = String(process.env.PAGINATION_ROWS || '10').trim().replace(/[;\s]+$/g, '');
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 10;
  }

  /**
   * Resolve created_by/updated_by FK ke nama user untuk tampil di UI
   */
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
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/facility/insert
   * Body: { name, description?, icon?, category?, sort_order? }
   * Auth: verifyToken (req.user.userId = user_id pembuat)
   */
  static async insertDataFacility(req, res) {
    const { name, description, icon, category, sort_order } = req.body;
    const createdBy = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama fasilitas wajib diisi');
    }

    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const existingName = await Facility.findOne({
        where: {
          name:   { [Op.like]: String(name).trim() },
          status: { [Op.ne]: 3 }
        }
      });
      if (existingName) {
        return sendError(res, HTTP.CONFLICT, null, `Fasilitas "${String(name).trim()}" sudah ada`);
      }

      const totalFacilities = await Facility.count();
      const facilityId      = FacilityMasterController.#makeFacilityId(name, totalFacilities).toUpperCase();

      const sortOrderValue = sort_order !== undefined && sort_order !== null && sort_order !== ''
        ? parseInt(sort_order, 10) || 0
        : 0;

      const newFacility = await Facility.create({
        facility_id:  facilityId,
        name:         String(name).trim(),
        description:  description ? String(description).trim() : null,
        icon:         icon        ? String(icon).trim()        : null,
        category:     category    ? String(category).trim()    : null,
        sort_order:   sortOrderValue,
        status:       1,
        created_date: FacilityMasterController.#todayDate(),
        created_by:   createdBy,
        updated_date: null,
        updated_by:   null
      });

      console.log(`[FACILITY] ✅ INSERT — ${newFacility.facility_id} | "${newFacility.name}" | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        facility: {
          id:           newFacility.id,
          facility_id:  newFacility.facility_id,
          name:         newFacility.name,
          description:  newFacility.description,
          icon:         newFacility.icon,
          category:     newFacility.category,
          sort_order:   newFacility.sort_order,
          status:       newFacility.status,
          created_date: newFacility.created_date,
          created_by:   newFacility.created_by
        }
      }, 'Fasilitas berhasil ditambahkan');

    } catch (error) {
      console.error('[FACILITY INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan fasilitas: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/facility/update/:facility_id
   * Body: { name, description?, icon?, category?, sort_order? }
   * Auth: verifyToken
   */
  static async updateDataFacility(req, res) {
    const { facility_id } = req.params;
    const { name, description, icon, category, sort_order } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!facility_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'facility_id wajib disertakan');
    }

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama fasilitas wajib diisi');
    }

    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const facility = await Facility.findOne({ where: { facility_id, status: { [Op.ne]: 3 } } });
      if (!facility) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Fasilitas tidak ditemukan');
      }

      const duplicateName = await Facility.findOne({
        where: {
          name:        { [Op.like]: String(name).trim() },
          facility_id: { [Op.ne]: facility_id },
          status:      { [Op.ne]: 3 }
        }
      });
      if (duplicateName) {
        return sendError(res, HTTP.CONFLICT, null, `Nama fasilitas "${String(name).trim()}" sudah dipakai oleh fasilitas lain`);
      }

      const sortOrderValue = sort_order !== undefined && sort_order !== null && sort_order !== ''
        ? parseInt(sort_order, 10) || 0
        : facility.sort_order;

      await facility.update({
        name:         String(name).trim(),
        description:  description !== undefined ? (description ? String(description).trim() : null) : facility.description,
        icon:         icon        !== undefined ? (icon        ? String(icon).trim()        : null) : facility.icon,
        category:     category    !== undefined ? (category    ? String(category).trim()    : null) : facility.category,
        sort_order:   sortOrderValue,
        updated_date: FacilityMasterController.#todayDate(),
        updated_by:   updatedBy
      });

      const creatorName = await FacilityMasterController.#resolveUserName(facility.created_by);
      const updaterName = await FacilityMasterController.#resolveUserName(updatedBy);

      console.log(`[FACILITY] ✏️  UPDATE — ${facility.facility_id} | "${facility.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        facility: {
          id:           facility.id,
          facility_id:  facility.facility_id,
          name:         facility.name,
          description:  facility.description,
          icon:         facility.icon,
          category:     facility.category,
          sort_order:   facility.sort_order,
          status:       facility.status,
          created_date: facility.created_date,
          created_by:   facility.created_by,
          created_by_name: creatorName,
          updated_date: facility.updated_date,
          updated_by:   facility.updated_by,
          updated_by_name: updaterName
        }
      }, 'Fasilitas berhasil diperbarui');

    } catch (error) {
      console.error('[FACILITY UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui fasilitas: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/facility/list?page=1&search=&category=
   * Menampilkan fasilitas status 1 dan 2 (exclude deleted/status=3)
   * Auth: verifyToken
   */
  static async showDataFacility(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = FacilityMasterController.#pageSize();
      const offset   = (page - 1) * pageSize;

      const search   = req.query.search   ? String(req.query.search).trim()   : '';
      const category = req.query.category ? String(req.query.category).trim() : '';

      const where = { status: { [Op.ne]: 3 } };

      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }
      if (category) {
        where.category = { [Op.like]: `%${category}%` };
      }

      const { count, rows } = await Facility.findAndCountAll({
        where,
        order:  [['sort_order', 'ASC'], ['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      const facilities = rows.map((f, index) => ({
        no:           offset + index + 1,
        id:           f.id,
        facility_id:  f.facility_id,
        name:         f.name,
        description:  f.description,
        icon:         f.icon,
        category:     f.category,
        sort_order:   f.sort_order,
        status:       f.status,
        status_label: f.status === 1 ? 'Aktif' : 'Disabled',
        created_date: f.created_date,
        created_by:   f.created_by,
        updated_date: f.updated_date,
        updated_by:   f.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        facilities,
        pagination: {
          total:        count,
          page,
          pageSize,
          totalPages,
          hasNextPage:  page < totalPages,
          hasPrevPage:  page > 1
        }
      }, 'Data fasilitas berhasil dimuat');

    } catch (error) {
      console.error('[FACILITY LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data fasilitas');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/facility/detail/:facility_id
   * Auth: verifyToken
   */
  static async getDetailFacility(req, res) {
    const { facility_id } = req.params;
    try {
      const facility = await Facility.findOne({ where: { facility_id, status: { [Op.ne]: 3 } } });
      if (!facility) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Fasilitas tidak ditemukan');
      }

      const creatorName = await FacilityMasterController.#resolveUserName(facility.created_by);
      const updaterName = await FacilityMasterController.#resolveUserName(facility.updated_by);

      return sendSuccess(res, HTTP.OK, {
        facility: {
          id:              facility.id,
          facility_id:     facility.facility_id,
          name:            facility.name,
          description:     facility.description,
          icon:            facility.icon,
          category:        facility.category,
          sort_order:      facility.sort_order,
          status:          facility.status,
          status_label:    facility.status === 1 ? 'Aktif' : 'Disabled',
          created_date:    facility.created_date,
          created_by:      facility.created_by,
          created_by_name: creatorName,
          updated_date:    facility.updated_date,
          updated_by:      facility.updated_by,
          updated_by_name: updaterName
        }
      }, 'Detail fasilitas berhasil dimuat');

    } catch (error) {
      console.error('[FACILITY DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail fasilitas');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/facility/toggle-status/:facility_id
   * Aktif (1) ↔ Disabled (2). Tidak berlaku untuk status deleted (3).
   * Auth: verifyToken
   */
  static async toggleStatusFacility(req, res) {
    const { facility_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const facility = await Facility.findOne({ where: { facility_id, status: { [Op.ne]: 3 } } });
      if (!facility) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Fasilitas tidak ditemukan');
      }

      const newStatus = facility.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await facility.update({
        status:       newStatus,
        updated_date: FacilityMasterController.#todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[FACILITY] 🔄 TOGGLE — ${facility.facility_id} | "${facility.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        facility_id: facility.facility_id,
        name:        facility.name,
        status:      newStatus,
        status_label: label
      }, `Fasilitas "${facility.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[FACILITY TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status fasilitas');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/facility/delete/:facility_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteFacility(req, res) {
    const { facility_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const facility = await Facility.findOne({ where: { facility_id, status: { [Op.ne]: 3 } } });
      if (!facility) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Fasilitas tidak ditemukan atau sudah dihapus');
      }

      await facility.update({
        status:       3,
        updated_date: FacilityMasterController.#todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[FACILITY] 🗑️  DELETE — ${facility.facility_id} | "${facility.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        facility_id: facility.facility_id,
        name:        facility.name
      }, `Fasilitas "${facility.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[FACILITY DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus fasilitas');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     KATEGORI LIST (untuk dropdown filter)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/facility/categories
   * Daftar kategori unik yang ada di data fasilitas.
   * Auth: verifyToken
   */
  static async getCategories(req, res) {
    try {
      const rows = await Facility.findAll({
        where: {
          status:   { [Op.ne]: 3 },
          category: { [Op.ne]: null }
        },
        attributes: ['category'],
        group:      ['category'],
        order:      [['category', 'ASC']]
      });

      const categories = rows.map(r => r.category).filter(Boolean);
      return sendSuccess(res, HTTP.OK, { categories }, 'Kategori fasilitas berhasil dimuat');

    } catch (error) {
      console.error('[FACILITY CATEGORIES ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat kategori');
    }
  }
}

module.exports = FacilityMasterController;
