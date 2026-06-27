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
const { Facility } = require('../models');
const { HTTP }     = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

/* ════════════════════════════════════════════════════════════════════════════
   ANTI-REDUNDANCY — kelompok sinonim fasilitas
   ────────────────────────────────────────────────────────────────────────────
   Setiap grup berisi istilah-istilah yang BERMAKNA SAMA. Elemen pertama tiap
   grup = nama kanonik. Saat user input fasilitas, namanya dinormalisasi
   (huruf kecil, tanpa tanda baca, spasi dirapikan) lalu dicocokkan ke grup ini.
   Jika dua input memetakan ke kanonik yang sama → dianggap duplikat.

   Contoh yang dicegah:
     "AC" / "air conditioner" / "pendingin ruangan"        → kanonik "ac"
     "gym" / "gym club" / "tempat gym"                      → kanonik "gym"
     "kolam renang" / "swimming pool" / "tempat berenang"  → kanonik "kolam renang"
     "satpam" / "security" / "penjaga"                      → kanonik "satpam"
     "cctv" / "kamera pengawas" / "camera"                  → kanonik "cctv"

   Tambahkan grup baru di sini bila ada sinonim lain yang perlu disatukan.
════════════════════════════════════════════════════════════════════════════ */
const FACILITY_SYNONYM_GROUPS = [
  ['ac', 'air conditioner', 'air conditioning', 'pendingin ruangan', 'pendingin udara', 'penyejuk ruangan'],
  ['parkir mobil', 'tempat parkir mobil', 'area parkir mobil', 'lahan parkir mobil', 'parking mobil', 'car park'],
  ['parkir motor', 'tempat parkir motor', 'area parkir motor', 'parking motor'],
  ['gym', 'gym club', 'tempat gym', 'ruang gym', 'fitness', 'fitness center', 'fitnes', 'pusat kebugaran'],
  ['kolam renang', 'tempat berenang', 'swimming pool', 'pool'],
  ['satpam', 'security', 'sekuriti', 'penjaga', 'penjaga keamanan', 'petugas keamanan', 'keamanan 24 jam'],
  ['cctv', 'kamera pengawas', 'kamera cctv', 'kamera keamanan', 'kamera', 'camera'],
  ['wifi', 'wi fi', 'internet', 'koneksi internet', 'wireless internet'],
  ['lift', 'elevator'],
  ['mushola', 'musholla', 'mushollah', 'masjid', 'tempat ibadah'],
  ['dapur', 'kitchen', 'kitchen set', 'pantry'],
  ['carport', 'kanopi mobil'],
  ['taman', 'garden', 'taman hijau'],
];

class FacilityMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     PRIVATE HELPERS — hanya yang unik untuk fasilitas
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * Kunci kanonik: jika nama (ternormalisasi) ada di salah satu grup sinonim,
   * kembalikan istilah kanonik grup tsb; jika tidak, kembalikan nama ternormalisasi.
   * Dua nama yang menghasilkan kunci sama dianggap fasilitas yang sama.
   */
  static #canonicalKey(name) {
    const norm = GeneralController.normalizeName(name);
    for (const group of FACILITY_SYNONYM_GROUPS) {
      if (group.includes(norm)) return group[0];
    }
    return norm;
  }

  /**
   * Cari fasilitas aktif (status ≠ 3) yang duplikat/sinonim dengan `name`.
   * @param {string} name             Nama yang akan dicek
   * @param {string|null} excludeId   facility_id yang dikecualikan (untuk update)
   * @returns {Promise<Facility|null>} Fasilitas existing yang bentrok, atau null
   */
  static async #findRedundant(name, excludeId = null) {
    const targetKey = FacilityMasterController.#canonicalKey(name);
    if (!targetKey) return null;

    const where = { status: { [Op.ne]: 3 } };
    if (excludeId) where.facility_id = { [Op.ne]: excludeId };

    const existing = await Facility.findAll({ where, attributes: ['facility_id', 'name'] });
    return existing.find(f => FacilityMasterController.#canonicalKey(f.name) === targetKey) || null;
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/facility/insert
   * Body: { name, description?, icon? }
   * Auth: verifyToken (req.user.userId = user_id pembuat)
   */
  static async insertDataFacility(req, res) {
    const { name, description, icon } = req.body;
    const createdBy = req.user?.userId || null;

    if (!name || !String(name).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Nama fasilitas wajib diisi');
    }

    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }

    try {
      // Anti-redundancy: tolak nama yang sama (beda kapital/spasi) ATAU sinonim
      const redundant = await FacilityMasterController.#findRedundant(name);
      if (redundant) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Fasilitas "${String(name).trim()}" sudah ada atau serupa dengan "${redundant.name}". Gunakan fasilitas yang sudah ada untuk menghindari data duplikat.`
        );
      }

      const totalFacilities = await Facility.count();
      const facilityId      = GeneralController.generateRandomId(name, totalFacilities).toUpperCase();

      const newFacility = await Facility.create({
        facility_id:  facilityId,
        name:         String(name).trim().toUpperCase(),
        description:  description ? String(description).trim().toUpperCase() : null,
        icon:         icon        ? String(icon).trim()        : null,
        status:       1,
        created_date: GeneralController.todayDate(),
        created_by:   createdBy.toUpperCase(),
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
   * Body: { name, description?, icon? }
   * Auth: verifyToken
   */
  static async updateDataFacility(req, res) {
    const { facility_id } = req.params;
    const { name, description, icon } = req.body;
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

      const redundant = await FacilityMasterController.#findRedundant(name, facility_id);
      if (redundant) {
        return sendError(
          res, HTTP.CONFLICT, null,
          `Nama "${String(name).trim()}" duplikat/serupa dengan fasilitas "${redundant.name}". Pilih nama lain yang berbeda makna.`
        );
      }

      await facility.update({
        name:         String(name).trim().toUpperCase(),
        description:  description !== undefined ? (description ? String(description).trim() : null) : facility.description,
        icon:         icon        !== undefined ? (icon        ? String(icon).trim()        : null) : facility.icon,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      const creatorName = await GeneralController.resolveUserName(facility.created_by);
      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[FACILITY] ✏️  UPDATE — ${facility.facility_id} | "${facility.name}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        facility: {
          id:           facility.id,
          facility_id:  facility.facility_id,
          name:         facility.name,
          description:  facility.description,
          icon:         facility.icon,
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
   * GET /api/facility/list?page=1&search=
   * Menampilkan fasilitas status 1 dan 2 (exclude deleted/status=3)
   * Auth: verifyToken
   */
  static async showDataFacility(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;

      const search   = req.query.search   ? String(req.query.search).trim()   : '';

      const where = { status: { [Op.ne]: 3 } };

      if (search) {
        where.name = { [Op.like]: `%${search}%` };
      }

      const { count, rows } = await Facility.findAndCountAll({
        where,
        order:  [['name', 'ASC']],
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

      const creatorName = await GeneralController.resolveUserName(facility.created_by);
      const updaterName = await GeneralController.resolveUserName(facility.updated_by);

      return sendSuccess(res, HTTP.OK, {
        facility: {
          id:              facility.id,
          facility_id:     facility.facility_id,
          name:            facility.name,
          description:     facility.description,
          icon:            facility.icon,
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
        updated_date: GeneralController.todayDate(),
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
        updated_date: GeneralController.todayDate(),
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
}

module.exports = FacilityMasterController;
