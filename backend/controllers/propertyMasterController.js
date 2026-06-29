/**
 * propertyMasterController.js
 *
 * CRUD controller untuk master properti.
 *
 * property_id formula: prefix judul (2 huruf kapital) + random 5 alphanumeric + count padded 3 digit
 * Contoh: "Rumah Citraland Surabaya" + 5 data → "RCAb3x006"
 *
 * Status: 1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)
 * kpr_status: 'Y' / 'N' — otomatis 'N' jika transaction_type = 'Rent'
 */

const { Op }       = require('sequelize');
const {
  Property, PropertyImage, PropertyFacility,
  City, Province, Country, Facility, User
} = require('../models');
const { HTTP }     = require('../utils/httpStatus');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const GeneralController = require('./GeneralController');

/* ════════════════════════════════════════════════════════════════════════════
   KONSTANTA
════════════════════════════════════════════════════════════════════════════ */

const VALID_BUILDING_TYPES = [
  'house', 'apartment', 'hotel', 'villa', 'boarding_house',
  'shophouse', 'office', 'warehouse', 'store', 'condo', 'mansion', 'others'
];

const VALID_TRANSACTION_TYPES = ['Rent', 'Sale'];
const VALID_FURNISHED    = ['Full Furnished', 'Semi Furnished', 'Unfurnished'];
const VALID_PRICE_TYPES  = ['Night', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Cash', 'Negotiable', 'Others'];

class PropertyMasterController extends GeneralController {

  /* ──────────────────────────────────────────────────────────────────────────
     PRIVATE HELPERS
  ────────────────────────────────────────────────────────────────────────── */

  /** Validasi keberadaan city, province, country di DB (status ≠ 3) */
  static async #validateRegion(city_id, province_id, country_id) {
    const [city, province, country] = await Promise.all([
      City.findOne({ where: { city_id, status: { [Op.ne]: 3 } }, attributes: ['city_id', 'name'] }),
      Province.findOne({ where: { province_id, status: { [Op.ne]: 3 } }, attributes: ['province_id', 'name'] }),
      Country.findOne({ where: { country_id, status: { [Op.ne]: 3 } }, attributes: ['country_id', 'name'] }),
    ]);
    return { city, province, country };
  }

  /** Format harga ke rupiah untuk log */
  static #formatPrice(price) {
    if (price == null) return '-';
    return 'Rp ' + Number(price).toLocaleString('id-ID');
  }

  /** Normalize numeric field: empty string / undefined → null */
  static #num(v) {
    if (v === '' || v === undefined || v === null) return null;
 
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  /**
   * Sinkronkan fasilitas properti (multi-select dari modal).
   * Strategi: hapus semua property_facilities lama untuk property_id, lalu
   * buat ulang dari array `facilities`. Hanya facility_id valid (status ≠ 3)
   * yang disimpan. `facilities` = [{ facility_id, facility_qty? }].
   */
  static async #syncFacilities(propertyId, facilities, userId) {
    if (!Array.isArray(facilities)) return;

    // Bersihkan relasi lama
    await PropertyFacility.destroy({ where: { property_id: propertyId } });
    if (facilities.length === 0) return;

    // Validasi facility_id yang dikirim memang ada & aktif
    const requestedIds = [...new Set(
      facilities.map(f => (f && f.facility_id ? String(f.facility_id).trim() : null)).filter(Boolean)
    )];
    if (requestedIds.length === 0) return;

    const validRows = await Facility.findAll({
      where: { facility_id: { [Op.in]: requestedIds }, status: { [Op.ne]: 3 } },
      attributes: ['facility_id']
    });
    const validIds = new Set(validRows.map(r => r.facility_id));

    const today = GeneralController.todayDate();
    const records = facilities
      .filter(f => f && validIds.has(String(f.facility_id).trim()))
      .map(f => ({
        property_id:  propertyId,
        facility_id:  String(f.facility_id).trim(),
        facility_qty: f.facility_qty != null && f.facility_qty !== '' ? Number(f.facility_qty) : null,
        created_date: today,
        created_by:   userId,
        updated_date: null,
        updated_by:   null
      }));

    if (records.length) await PropertyFacility.bulkCreate(records);
  }

  /* ──────────────────────────────────────────────────────────────────────────
     INSERT
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * POST /api/property/insert
   * Body: { city_id, province_id, country_id, title, description?, price?, price_type,
   *         address?, area?, district?, postal_code?, furnished_status?,
   *         bed_rooms?, bath_rooms?, electricity_capacity?, building_area?,
   *         land_area?, floor_location?, floor_quantity?, kpr_status?, building_type, transaction_type }
   * Auth: verifyToken
   */
  static async insertDataProperty(req, res) {
    const {
      city_id, province_id, country_id,
      title, description, price, price_type, address, area, district, postal_code,
      furnished_status, bed_rooms, bath_rooms, electricity_capacity,
      building_area, land_area, floor_location, floor_quantity, kpr_status,
      building_type, transaction_type, facilities
    } = req.body;

    const createdBy = req.user?.userId || null;

    // ── Validasi wajib ──────────────────────────────────────────────────────
    if (!createdBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }
    if (!title || !String(title).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Judul properti wajib diisi');
    }
    if (!city_id || !province_id || !country_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Kota, provinsi, dan negara wajib dipilih');
    }
    if (!building_type || !VALID_BUILDING_TYPES.includes(building_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `Tipe bangunan tidak valid. Pilih salah satu: ${VALID_BUILDING_TYPES.join(', ')}`);
    }
    if (!transaction_type || !VALID_TRANSACTION_TYPES.includes(transaction_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Tipe transaksi harus Rent atau Sale');
    }
    if (furnished_status && !VALID_FURNISHED.includes(furnished_status)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `furnished_status tidak valid. Pilih: ${VALID_FURNISHED.join(', ')}`);
    }
    if (!price_type || !VALID_PRICE_TYPES.includes(price_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `Tipe harga wajib dipilih. Pilih: ${VALID_PRICE_TYPES.join(', ')}`);
    }

    try {
      // Validasi region
      const { city, province, country } = await PropertyMasterController.#validateRegion(city_id, province_id, country_id);
      if (!city)     return sendError(res, HTTP.BAD_REQUEST, null, 'Kota tidak ditemukan atau tidak aktif');
      if (!province) return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi tidak ditemukan atau tidak aktif');
      if (!country)  return sendError(res, HTTP.BAD_REQUEST, null, 'Negara tidak ditemukan atau tidak aktif');

      // kpr_status: Rent tidak bisa KPR
      const resolvedKpr = transaction_type === 'Rent' ? 'N' : (kpr_status === 'Y' ? 'Y' : 'N');

      const totalProperties = await Property.count();
      const propertyId      = GeneralController.generateRandomId(title, totalProperties).toUpperCase();

      const newProperty = await Property.create({
        property_id:          propertyId,
        city_id,
        province_id,
        country_id,
        title:                String(title).trim(),
        description:          description ? String(description).trim() : null,
        price:                PropertyMasterController.#num(price),
        price_type:           price_type,
        address:              address      ? String(address).trim()      : null,
        area:                 area         ? String(area).trim()         : null,
        district:             district     ? String(district).trim()     : null,
        postal_code:          postal_code  ? String(postal_code).trim()  : null,
        furnished_status:     furnished_status || null,
        bed_rooms:            PropertyMasterController.#num(bed_rooms),
        bath_rooms:           PropertyMasterController.#num(bath_rooms),
        electricity_capacity: PropertyMasterController.#num(electricity_capacity),
        building_area:        building_area  ? String(building_area).trim()  : null,
        land_area:            land_area      ? String(land_area).trim()      : null,
        floor_location:       floor_location ? String(floor_location).trim() : null,
        floor_quantity:       PropertyMasterController.#num(floor_quantity),
        kpr_status:           resolvedKpr,
        building_type,
        transaction_type,
        status:               1,
        created_date:         GeneralController.todayDate(),
        created_by:           createdBy,
        updated_date:         null,
        updated_by:           null
      });

      // Simpan fasilitas terpilih (jika ada)
      await PropertyMasterController.#syncFacilities(newProperty.property_id, facilities, createdBy);

      console.log(`[PROPERTY] ✅ INSERT — ${newProperty.property_id} | "${newProperty.title}" | ${city.name}, ${province.name} | By: ${createdBy}`);

      return sendSuccess(res, HTTP.CREATED, {
        property: {
          property_id:   newProperty.property_id,
          title:         newProperty.title,
          city:          city.name,
          province:      province.name,
          country:       country.name,
          building_type:    newProperty.building_type,
          transaction_type: newProperty.transaction_type,
          price:            newProperty.price,
          price_type:       newProperty.price_type,
          status:           newProperty.status,
          created_date:     newProperty.created_date,
          created_by:       newProperty.created_by
        }
      }, 'Properti berhasil ditambahkan');

    } catch (error) {
      console.error('[PROPERTY INSERT ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan properti: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     UPDATE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PUT /api/property/update/:property_id
   * Body: semua field yang sama dengan insert (semua opsional kecuali field wajib)
   * Auth: verifyToken
   */
  static async updateDataProperty(req, res) {
    const { property_id } = req.params;
    const {
      city_id, province_id, country_id,
      title, description, price, price_type, address, area, district, postal_code,
      furnished_status, bed_rooms, bath_rooms, electricity_capacity,
      building_area, land_area, floor_location, floor_quantity, kpr_status,
      building_type, transaction_type, facilities
    } = req.body;

    const updatedBy = req.user?.userId || null;

    if (!property_id) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'property_id wajib disertakan');
    }
    if (!updatedBy) {
      return sendError(res, HTTP.UNAUTHORIZED, null, 'Sesi tidak valid, silakan login ulang');
    }
    if (title !== undefined && !String(title).trim()) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Judul properti tidak boleh kosong');
    }
    if (building_type && !VALID_BUILDING_TYPES.includes(building_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `Tipe bangunan tidak valid. Pilih salah satu: ${VALID_BUILDING_TYPES.join(', ')}`);
    }
    if (transaction_type && !VALID_TRANSACTION_TYPES.includes(transaction_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, 'Tipe transaksi harus Rent atau Sale');
    }
    if (furnished_status && !VALID_FURNISHED.includes(furnished_status)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `furnished_status tidak valid. Pilih: ${VALID_FURNISHED.join(', ')}`);
    }
    if (price_type !== undefined && !VALID_PRICE_TYPES.includes(price_type)) {
      return sendError(res, HTTP.BAD_REQUEST, null, `price_type tidak valid. Pilih: ${VALID_PRICE_TYPES.join(', ')}`);
    }

    try {
      const property = await Property.findOne({ where: { property_id, status: { [Op.ne]: 3 } } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan');
      }

      // Validasi region jika ada yang berubah
      const newCityId     = city_id     ?? property.city_id;
      const newProvinceId = province_id ?? property.province_id;
      const newCountryId  = country_id  ?? property.country_id;

      const { city, province, country } = await PropertyMasterController.#validateRegion(newCityId, newProvinceId, newCountryId);
      if (!city)     return sendError(res, HTTP.BAD_REQUEST, null, 'Kota tidak ditemukan atau tidak aktif');
      if (!province) return sendError(res, HTTP.BAD_REQUEST, null, 'Provinsi tidak ditemukan atau tidak aktif');
      if (!country)  return sendError(res, HTTP.BAD_REQUEST, null, 'Negara tidak ditemukan atau tidak aktif');

      const resolvedTransType = transaction_type ?? property.transaction_type;
      const resolvedKpr = resolvedTransType === 'Rent'
        ? 'N'
        : (kpr_status !== undefined ? (kpr_status === 'Y' ? 'Y' : 'N') : property.kpr_status);

      const updatePayload = {
        city_id:              newCityId,
        province_id:          newProvinceId,
        country_id:           newCountryId,
        transaction_type:     resolvedTransType,
        kpr_status:           resolvedKpr,
        updated_date:         GeneralController.todayDate(),
        updated_by:           updatedBy
      };

      // Update field opsional hanya jika dikirim
      if (title             !== undefined) updatePayload.title             = String(title).trim();
      if (description       !== undefined) updatePayload.description       = description ? String(description).trim() : null;
      if (price             !== undefined) updatePayload.price             = PropertyMasterController.#num(price);
      if (price_type        !== undefined) updatePayload.price_type        = price_type;
      if (address           !== undefined) updatePayload.address           = address ? String(address).trim() : null;
      if (area              !== undefined) updatePayload.area              = area    ? String(area).trim()    : null;
      if (district          !== undefined) updatePayload.district          = district ? String(district).trim() : null;
      if (postal_code       !== undefined) updatePayload.postal_code       = postal_code ? String(postal_code).trim() : null;
      if (furnished_status  !== undefined) updatePayload.furnished_status  = furnished_status || null;
      if (bed_rooms         !== undefined) updatePayload.bed_rooms         = PropertyMasterController.#num(bed_rooms);
      if (bath_rooms        !== undefined) updatePayload.bath_rooms        = PropertyMasterController.#num(bath_rooms);
      if (electricity_capacity !== undefined) updatePayload.electricity_capacity = PropertyMasterController.#num(electricity_capacity);
      if (building_area     !== undefined) updatePayload.building_area     = building_area  ? String(building_area).trim()  : null;
      if (land_area         !== undefined) updatePayload.land_area         = land_area      ? String(land_area).trim()      : null;
      if (floor_location    !== undefined) updatePayload.floor_location    = floor_location ? String(floor_location).trim() : null;
      if (floor_quantity    !== undefined) updatePayload.floor_quantity    = PropertyMasterController.#num(floor_quantity);
      if (building_type     !== undefined) updatePayload.building_type     = building_type;

      await property.update(updatePayload);

      // Sinkronkan fasilitas hanya jika field dikirim (undefined = tidak diubah)
      if (facilities !== undefined) {
        await PropertyMasterController.#syncFacilities(property.property_id, facilities, updatedBy);
      }

      const creatorName = await GeneralController.resolveUserName(property.created_by);
      const updaterName = await GeneralController.resolveUserName(updatedBy);

      console.log(`[PROPERTY] ✏️  UPDATE — ${property.property_id} | "${property.title}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        property: {
          property_id:      property.property_id,
          title:            property.title,
          city:             city.name,
          province:         province.name,
          country:          country.name,
          building_type:    property.building_type,
          transaction_type: property.transaction_type,
          kpr_status:       property.kpr_status,
          price:            property.price,
          price_type:       property.price_type,
          status:           property.status,
          created_date:     property.created_date,
          created_by:       property.created_by,
          created_by_name:  creatorName,
          updated_date:     property.updated_date,
          updated_by:       property.updated_by,
          updated_by_name:  updaterName
        }
      }, 'Properti berhasil diperbarui');

    } catch (error) {
      console.error('[PROPERTY UPDATE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memperbarui properti: ' + (error.message || 'Unknown error'));
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     LIST (dengan pagination & filter)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/property/list?page=1&search=&transaction_type=&building_type=&city_id=&province_id=
   * Menampilkan properti status 1 dan 2 (exclude deleted/status=3)
   * Auth: verifyToken
   */
  static async showDataProperty(req, res) {
    try {
      const page     = Math.max(1, parseInt(req.query.page, 10) || 1);
      const pageSize = GeneralController.pageSize();
      const offset   = (page - 1) * pageSize;

      const search           = req.query.search           ? String(req.query.search).trim()           : '';
      const filterTxType     = req.query.transaction_type ? String(req.query.transaction_type).trim()  : '';
      const filterBuildType  = req.query.building_type    ? String(req.query.building_type).trim()     : '';
      const filterCityId     = req.query.city_id          ? String(req.query.city_id).trim()           : '';
      const filterProvinceId = req.query.province_id      ? String(req.query.province_id).trim()       : '';

      const where = { status: { [Op.ne]: 3 } };
      if (search)           where.title            = { [Op.like]: `%${search}%` };
      if (filterTxType)     where.transaction_type = filterTxType;
      if (filterBuildType)  where.building_type    = filterBuildType;
      if (filterCityId)     where.city_id          = filterCityId;
      if (filterProvinceId) where.province_id      = filterProvinceId;

      const { count, rows } = await Property.findAndCountAll({
        where,
        include: [
          { model: City,     as: 'city',     attributes: ['name'], required: false },
          { model: Province, as: 'province', attributes: ['name'], required: false },
          { model: Country,  as: 'country',  attributes: ['name'], required: false }
        ],
        order:  [['created_date', 'DESC'], ['title', 'ASC']],
        limit:  pageSize,
        offset,
        distinct: true
      });

      const totalPages = Math.ceil(count / pageSize);

      const properties = rows.map((p, index) => ({
        no:               offset + index + 1,
        property_id:      p.property_id,
        title:            p.title,
        price:            p.price,
        price_display:    p.price != null
          ? 'Rp ' + Number(p.price).toLocaleString('id-ID') + (['Cash', 'Negotiable'].includes(p.price_type) ? ' (' + p.price_type + ')' : '/' + p.price_type)
          : '-',
        price_type:       p.price_type,
        building_type:    p.building_type,
        transaction_type: p.transaction_type,
        kpr_status:       p.kpr_status,
        city:             p.city?.name     || '-',
        province:         p.province?.name || '-',
        country:          p.country?.name  || '-',
        status:           p.status,
        status_label:     p.status === 1 ? 'Aktif' : 'Disabled',
        created_date:     p.created_date,
        created_by:       p.created_by,
        updated_date:     p.updated_date,
        updated_by:       p.updated_by
      }));

      return sendSuccess(res, HTTP.OK, {
        properties,
        pagination: {
          total:       count,
          page,
          pageSize,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }, 'Data properti berhasil dimuat');

    } catch (error) {
      console.error('[PROPERTY LIST ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat data properti');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     DETAIL (untuk halaman edit / view)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * GET /api/property/detail/:property_id
   * Include: city, province, country, images, facilities (dengan nama fasilitas)
   * Auth: verifyToken
   */
  static async getDetailProperty(req, res) {
    const { property_id } = req.params;
    try {
      const property = await Property.findOne({
        where: { property_id, status: { [Op.ne]: 3 } },
        include: [
          { model: City,     as: 'city',       attributes: ['city_id', 'name'],         required: false },
          { model: Province, as: 'province',   attributes: ['province_id', 'name'],     required: false },
          { model: Country,  as: 'country',    attributes: ['country_id', 'name'],      required: false },
          {
            model: PropertyImage, as: 'images',
            attributes: ['property_id', 'name', 'url'],
            required: false
          },
          {
            model: PropertyFacility, as: 'facilities',
            attributes: ['property_id', 'facility_id', 'facility_qty'],
            required: false,
            include: [
              { model: Facility, as: 'facility', attributes: ['name', 'icon'], required: false }
            ]
          }
        ]
      });

      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan');
      }

      const creatorName = await GeneralController.resolveUserName(property.created_by);
      const updaterName = await GeneralController.resolveUserName(property.updated_by);

      return sendSuccess(res, HTTP.OK, {
        property: {
          property_id:          property.property_id,
          city_id:              property.city_id,
          province_id:          property.province_id,
          country_id:           property.country_id,
          city:                 property.city?.name     || '-',
          province:             property.province?.name || '-',
          country:              property.country?.name  || '-',
          title:                property.title,
          description:          property.description,
          price:                property.price,
          price_type:           property.price_type,
          price_display:        property.price != null ? 'Rp ' + Number(property.price).toLocaleString('id-ID') : '-',
          address:              property.address,
          area:                 property.area,
          district:             property.district,
          postal_code:          property.postal_code,
          furnished_status:     property.furnished_status,
          bed_rooms:            property.bed_rooms,
          bath_rooms:           property.bath_rooms,
          electricity_capacity: property.electricity_capacity,
          building_area:        property.building_area,
          land_area:            property.land_area,
          floor_location:       property.floor_location,
          floor_quantity:       property.floor_quantity,
          kpr_status:           property.kpr_status,
          building_type:        property.building_type,
          transaction_type:     property.transaction_type,
          status:               property.status,
          status_label:         property.status === 1 ? 'Aktif' : 'Disabled',
          images:               property.images || [],
          facilities:           (property.facilities || []).map(f => ({
            facility_id:   f.facility_id,
            facility_qty:  f.facility_qty,
            name:          f.facility?.name || '-',
            icon:          f.facility?.icon || null
          })),
          created_date:         property.created_date,
          created_by:           property.created_by,
          created_by_name:      creatorName,
          updated_date:         property.updated_date,
          updated_by:           property.updated_by,
          updated_by_name:      updaterName
        }
      }, 'Detail properti berhasil dimuat');

    } catch (error) {
      console.error('[PROPERTY DETAIL ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal memuat detail properti');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     TOGGLE STATUS (Aktif ↔ Disabled)
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * PATCH /api/property/toggle-status/:property_id
   * Aktif (1) ↔ Disabled (2). Tidak berlaku untuk status deleted (3).
   * Auth: verifyToken
   */
  static async toggleStatusProperty(req, res) {
    const { property_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const property = await Property.findOne({ where: { property_id, status: { [Op.ne]: 3 } } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan');
      }

      const newStatus  = property.status === 1 ? 2 : 1;
      const label      = newStatus === 1 ? 'Aktif' : 'Disabled';

      await property.update({
        status:       newStatus,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[PROPERTY] 🔄 TOGGLE — ${property.property_id} | "${property.title}" | Status: ${label} | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        property_id:  property.property_id,
        title:        property.title,
        status:       newStatus,
        status_label: label
      }, `Properti "${property.title}" berhasil diubah menjadi ${label}`);

    } catch (error) {
      console.error('[PROPERTY TOGGLE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal mengubah status properti');
    }
  }

  /* ──────────────────────────────────────────────────────────────────────────
     SOFT DELETE
  ────────────────────────────────────────────────────────────────────────── */

  /**
   * DELETE /api/property/delete/:property_id
   * Soft delete: update status → 3 (deleted).
   * Auth: verifyToken
   */
  static async deleteProperty(req, res) {
    const { property_id } = req.params;
    const updatedBy = req.user?.userId || null;

    try {
      const property = await Property.findOne({ where: { property_id, status: { [Op.ne]: 3 } } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan atau sudah dihapus');
      }

      await property.update({
        status:       3,
        updated_date: GeneralController.todayDate(),
        updated_by:   updatedBy
      });

      console.log(`[PROPERTY] 🗑️  DELETE — ${property.property_id} | "${property.title}" | By: ${updatedBy}`);

      return sendSuccess(res, HTTP.OK, {
        property_id: property.property_id,
        title:       property.title
      }, `Properti "${property.title}" berhasil dihapus`);

    } catch (error) {
      console.error('[PROPERTY DELETE ERROR]', error.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus properti');
    }
  }
}

module.exports = PropertyMasterController;
