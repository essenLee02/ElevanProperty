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
const { Location, City } = require('../models');
const { HTTP }     = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

class LocationMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     Cek duplikat nama lokasi (global) — delegasi ke GeneralController.
  ────────────────────────────────────────────────────────────────────────── */
  static #findDuplicate(name, excludeId = null) {
    return GeneralController.findDuplicateName(Location, name, { idField: 'location_id', excludeId });
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

  /* ──────────────────────────────────────────────────────────────────────────
     AREA OPTIONS — sumber nilai untuk Property.area (M143)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/location/areas?city_id=<id>
   *
   * Daftar KAWASAN (location_type='area') milik satu kota, untuk mengisi
   * dropdown/datalist `Property.area` di halaman tambah/edit properti.
   *
   * Kenapa endpoint TERPISAH dari /location/list:
   *   • /location/list ter-paginate (agent kehilangan pilihan di halaman 2), dan
   *   • mencampur landmark/commercial ke pilihan AREA membuat `Property.area`
   *     terisi nama toko/RS ("INDOMARET") alih-alih nama kawasan — persis
   *     pencemaran kosakata yang dicegah di M136 (getKnownLocations).
   *
   * `location_type='area'` SELALU punya city_id (hook validate Location.js),
   * jadi filter kota di sini aman dan tidak akan membuang baris yang sah.
   */
  static async getAreaOptions(req, res) {
    try {
      const cityId = String(req.query.city_id || '').trim();

      const where = { status: 1, location_type: 'area' };
      if (cityId) where.city_id = cityId;

      const rows = await Location.findAll({
        where,
        attributes: ['location_id', 'name', 'city_id'],
        order: [['name', 'ASC']],
      });

      return sendSuccess(res, HTTP.OK, {
        areas: rows.map(r => ({
          location_id: r.location_id,
          name:        r.name,
          city_id:     r.city_id,
        })),
      }, 'Opsi area berhasil dimuat');

    } catch (error) {
      console.error('[LOCATION AREA OPTIONS ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat opsi area');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     PICKER "LOKASI/PATOKAN TERDEKAT" — untuk halaman tambah/edit properti (M148)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/location/nearby-options?city_id=<id>&search=&page=
   *
   * Aturan (dari pemilik proyek, 25 Agu 2026):
   *   • location_type 'area' & 'landmark'  → HARUS satu kota dengan propertinya.
   *     Kawasan & patokan hanya masuk akal sebagai penanda lokasi bila memang
   *     berada di kota yang sama.
   *   • location_type 'commercial'         → TIDAK difilter kota. Indomaret,
   *     Alfamart, sekolah, stasiun, bank ada di mana-mana; membatasinya per
   *     kota hanya menyembunyikan pilihan yang sah.
   *
   * ⚠️ BEDA DARI SQL CONTOH: contoh memakai INNER JOIN ke `cities`, yang
   * DIAM-DIAM MEMBUANG seluruh baris commercial generik — di DB ini 572 baris
   * commercial memang sengaja ber-city_id NULL (INDOMARET, PASAR TRADISIONAL,
   * dst.), persis jenis patokan yang paling sering dipakai. Karena itu di sini
   * commercial diambil TANPA join kota, supaya maksud "tidak perlu cocokkan
   * kota" benar-benar terpenuhi.
   */
  static async getNearbyLocationOptions(req, res) {
    try {
      const cityId = String(req.query.city_id || '').trim();
      const search = String(req.query.search || '').trim();
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;

      // "*" = tampilkan semua (konvensi modal picker proyek ini).
      const searchClause = (search && search !== '*')
        ? { name: { [Op.like]: `%${search}%` } }
        : {};

      // area/landmark WAJIB sekota; tanpa city_id keduanya tidak ditawarkan
      // sama sekali (lebih baik kosong daripada menyarankan kawasan kota lain).
      const sameCityTypes = cityId
        ? { city_id: cityId, location_type: { [Op.in]: ['area', 'landmark'] } }
        : null;

      // commercial TIDAK difilter kota sama sekali (keputusan pemilik proyek,
      // 25 Agu 2026 — SQL contoh: `OR lc.location_type = 'commercial'`).
      // Catatan jujur: sebagian kecil baris commercial adalah tempat BERNAMA
      // milik satu kota (PLAZA SENAYAN, CITO MALL, AMBARRUKMO PLAZA), jadi
      // secara teori bisa muncul untuk properti di kota lain. Itu masalah
      // kualitas MASTER DATA (city_id-nya belum diisi), bukan logika picker —
      // dan nama kota kini ditampilkan di daftar sehingga agen bisa melihatnya.
      const commercialClause = { location_type: 'commercial' };

      const where = {
        status: 1,
        ...searchClause,
        [Op.or]: [
          ...(sameCityTypes ? [sameCityTypes] : []),
          commercialClause,
        ],
      };

      const { count, rows } = await Location.findAndCountAll({
        where,
        attributes: ['location_id', 'name', 'location_type', 'city_id', 'status'],
        order: [['location_type', 'ASC'], ['name', 'ASC']],
        limit: pageSize,
        offset,
      });

      // Nama kota untuk kolom "Kota" di picker (SQL contoh: IFNULL(cy.name,'')).
      // Dipakai lookup terpisah, bukan include: belum ada asosiasi
      // Location→City di models/index.js dan menambahkannya di sini berisiko
      // mengubah query lain yang memakai model Location.
      const cityIds = [...new Set(rows.map((r) => r.city_id).filter(Boolean))];
      const cityNameById = new Map();
      if (cityIds.length) {
        const cities = await City.findAll({
          where: { city_id: { [Op.in]: cityIds } },
          attributes: ['city_id', 'name'],
        });
        cities.forEach((cy) => cityNameById.set(cy.city_id, cy.name));
      }

      const totalPages = Math.ceil(count / pageSize);
      return sendSuccess(res, HTTP.OK, {
        locations: rows.map((r) => ({
          location_id  : r.location_id,
          name         : r.name,
          location_type: r.location_type,
          city_id      : r.city_id,
          city_name    : cityNameById.get(r.city_id) || '',   // '' = berlaku umum
          status       : r.status,
          status_label : r.status === 1 ? 'Aktif' : 'Disabled',
        })),
        pagination: {
          total: count, page, pageSize, totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }, 'Opsi lokasi patokan berhasil dimuat');

    } catch (error) {
      console.error('[LOCATION NEARBY OPTIONS ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat opsi lokasi patokan');
    }
  }
}

module.exports = LocationMasterController;
