/**
 * developerPropertyMasterController.js
 *
 * CRUD controller untuk master DEVELOPER/BRAND AGENSI properti
 * (Ray White, ERA Property, Xavier Marks, Galaxy Property, Brighton, Propnex, …).
 *
 * developer_property_id formula: prefix nama (2 huruf kapital) + random 5
 * alphanumeric + count padded 3 digit. Contoh: "Ray White" + 3 data → "RWAB3X004"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 *
 * ⚠️ Pola SENGAJA dibuat identik dengan facilityMasterController.js /
 * locationMasterController.js — extends GeneralController, memakai helper
 * bersama (generateRandomId, pageSize, todayDate, findDuplicateName,
 * resolveUserName). JANGAN menulis ulang helper itu di sini; duplikasi
 * helper antar master controller adalah persis alasan GeneralController
 * dibuat (lihat komentar kepala berkas itu).
 */

const { Op } = require('sequelize');
const { DeveloperProperty, User } = require('../models');
const { HTTP } = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

class DeveloperPropertyMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/developer-property/insert
   * Body: { name }
   * Auth: verifyToken (req.user.userId = user_id pembuat)
   */
  static async insertDataDeveloperProperty(req, res) {
    const { name } = req.body;
    const createdBy = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama developer property wajib diisi');
    }

    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      // Anti-duplikat: nama sama walau beda kapital/spasi ganda ditolak.
      const duplicate = await GeneralController.findDuplicateName(DeveloperProperty, name, {
        idField: 'developer_property_id'
      });
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Developer property "${String(name).trim()}" sudah terdaftar sebagai "${duplicate.name}".`
        );
      }

      const total = await DeveloperProperty.count();
      const developerPropertyId = GeneralController.generateRandomId(name, total).toUpperCase();

      const row = await DeveloperProperty.create({
        developer_property_id: developerPropertyId,
        name:         String(name).trim().toUpperCase(),
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   createdBy ? createdBy.toUpperCase() : null,
        updated_date: null,
        updated_by:   null
      });

      console.log(`[DEVELOPER PROPERTY] ✅ INSERT — ${row.developer_property_id} | "${row.name}" | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        developerProperty: {
          id:                    row.id,
          developer_property_id: row.developer_property_id,
          name:                  row.name,
          status:                row.status,
          created_date:          row.created_date,
          created_by:            row.created_by
        }
      }, 'Developer property berhasil ditambahkan');

    } catch (error) {
      console.error('[DEVELOPER PROPERTY INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan developer property: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/developer-property/update/:developer_property_id
   * Body: { name }
   */
  static async updateDataDeveloperProperty(req, res) {
    const { developer_property_id } = req.params;
    const { name } = req.body;
    const updatedBy = req.user?.userId || null;

    if (!developer_property_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'developer_property_id wajib disertakan');
    }
    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama developer property wajib diisi');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      const row = await DeveloperProperty.findOne({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });
      if (!row) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Developer property tidak ditemukan');
      }

      const duplicate = await GeneralController.findDuplicateName(DeveloperProperty, name, {
        idField: 'developer_property_id',
        excludeId: developer_property_id
      });
      if (duplicate) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat dengan developer property "${duplicate.name}".`
        );
      }

      await row.update({
        name:         String(name).trim().toUpperCase(),
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy ? updatedBy.toUpperCase() : null
      });

      const creatorName = await GeneralController.resolveUserName(row.created_by);
      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[DEVELOPER PROPERTY] ✏️  UPDATE — ${row.developer_property_id} | "${row.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        developerProperty: {
          id:                    row.id,
          developer_property_id: row.developer_property_id,
          name:                  row.name,
          status:                row.status,
          created_date:          row.created_date,
          created_by:            row.created_by,
          created_by_name:       creatorName,
          updated_date:          row.updated_date,
          updated_by:            row.updated_by,
          updated_by_name:       updaterName
        }
      }, 'Developer property berhasil diperbarui');

    } catch (error) {
      console.error('[DEVELOPER PROPERTY UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui developer property: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/developer-property/list?page=1&search=
   * Menampilkan status 1 dan 2 (exclude deleted/status=3)
   */
  static async showDataDeveloperProperty(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;
      const search   = req.query.search ? String(req.query.search).trim() : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search) where.name = { [Op.like]: `%${search}%` };

      const { count, rows } = await DeveloperProperty.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
        limit:  pageSize,
        offset
      });

      const totalPages = Math.ceil(count / pageSize);

      const developerProperties = rows.map((r, index) => ({
        no:                    offset + index + 1,
        id:                    r.id,
        developer_property_id: r.developer_property_id,
        name:                  r.name,
        status:                r.status,
        status_label:          r.status === 1 ? 'Aktif' : 'Disabled',
        created_date:          r.created_date,
        created_by:            r.created_by,
        updated_date:          r.updated_date,
        updated_by:            r.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        developerProperties,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data developer property berhasil dimuat');

    } catch (error) {
      console.error('[DEVELOPER PROPERTY LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data developer property');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     OPTIONS — dropdown (dipakai form profil/register agent)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/developer-property/options
   * Daftar RINGKAS (id + nama) developer AKTIF saja — untuk <select>.
   * Sengaja terpisah dari /list: dropdown tidak boleh ikut ter-paginate
   * (agent akan kehilangan pilihan di halaman 2 tanpa sadar) dan tidak
   * boleh menawarkan brand yang sudah di-disable.
   */
  static async getDeveloperPropertyOptions(req, res) {
    try {
      const rows = await DeveloperProperty.findAll({
        where: { status: 1 },
        attributes: ['developer_property_id', 'name'],
        order: [['name', 'ASC']]
      });

      return sendSuccess(res, HTTP.OK, {
        options: rows.map(r => ({
          developer_property_id: r.developer_property_id,
          name:                  r.name
        }))
      }, 'Opsi developer property berhasil dimuat');

    } catch (error) {
      console.error('[DEVELOPER PROPERTY OPTIONS ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat opsi developer property');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL
  ────────────────────────────────────────────────────────────────────────── */

  /** GET /api/developer-property/detail/:developer_property_id */
  static async getDetailDeveloperProperty(req, res) {
    const { developer_property_id } = req.params;
    try {
      const row = await DeveloperProperty.findOne({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });
      if (!row) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Developer property tidak ditemukan');
      }

      const creatorName = await GeneralController.resolveUserName(row.created_by);
      const updaterName = await GeneralController.resolveUserName(row.updated_by);

      // Jumlah agent yang memakai brand ini — ditampilkan di halaman edit supaya
      // admin tahu DAMPAK sebelum menonaktifkan/menghapus.
      const agentCount = await User.count({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });

      return sendSuccess(res, HTTP.OK, {
        developerProperty: {
          id:                    row.id,
          developer_property_id: row.developer_property_id,
          name:                  row.name,
          status:                row.status,
          status_label:          row.status === 1 ? 'Aktif' : 'Disabled',
          agent_count:           agentCount,
          created_date:          row.created_date,
          created_by:            row.created_by,
          created_by_name:       creatorName,
          updated_date:          row.updated_date,
          updated_by:            row.updated_by,
          updated_by_name:       updaterName
        }
      }, 'Detail developer property berhasil dimuat');

    } catch (error) {
      console.error('[DEVELOPER PROPERTY DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail developer property');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS
  ────────────────────────────────────────────────────────────────────────── */

  /** PATCH /api/developer-property/toggle-status/:developer_property_id */
  static async toggleStatusDeveloperProperty(req, res) {
    const { developer_property_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const row = await DeveloperProperty.findOne({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });
      if (!row) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Developer property tidak ditemukan');
      }

      const newStatus = row.status === 1 ? 2 : 1;
      const label     = newStatus === 1 ? 'Aktif' : 'Disabled';

      await row.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy ? updatedBy.toUpperCase() : null
      });

      console.log(`[DEVELOPER PROPERTY] 🔄 TOGGLE — ${row.developer_property_id} | "${row.name}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        developerProperty: {
          id:                    row.id,
          developer_property_id: row.developer_property_id,
          name:                  row.name,
          status:                newStatus,
          status_label:          label,
          created_date:          row.created_date,
          created_by:            row.created_by,
          created_by_name:       await GeneralController.resolveUserName(row.created_by),
          updated_date:          row.updated_date,
          updated_by:            row.updated_by,
          updated_by_name:       await GeneralController.resolveUserName(updatedBy)
        }
      }, `Developer property "${row.name}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[DEVELOPER PROPERTY TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status developer property');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/developer-property/delete/:developer_property_id
   * Soft delete: status → 3.
   *
   * ⛔ DITOLAK bila masih ada agent yang memakainya. Menghapusnya diam-diam
   * akan meninggalkan users.developer_property_id menunjuk baris "hantu" —
   * FK di proyek ini `constraints:false` (informasional), jadi DB TIDAK akan
   * menahannya untuk kita. Guard ini yang menahan.
   */
  static async deleteDeveloperProperty(req, res) {
    const { developer_property_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const row = await DeveloperProperty.findOne({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });
      if (!row) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Developer property tidak ditemukan atau sudah dihapus');
      }

      const agentCount = await User.count({
        where: { developer_property_id, status: { [Op.ne]: 3 } }
      });
      if (agentCount > 0) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Tidak bisa dihapus — masih dipakai ${agentCount} agent. ` +
          `Pindahkan agent tersebut ke developer property lain terlebih dahulu.`
        );
      }

      await row.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[DEVELOPER PROPERTY] 🗑️  DELETE — ${row.developer_property_id} | "${row.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        developer_property_id: row.developer_property_id,
        name:                  row.name
      }, `Developer property "${row.name}" berhasil dihapus`);

    } catch (error) {
      console.error('[DEVELOPER PROPERTY DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus developer property');
    }
  }
}

module.exports = DeveloperPropertyMasterController;
