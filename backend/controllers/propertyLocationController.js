const { PropertyLocation, Location, Property } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseFormat');
const { HTTP } = require('../utils/httpStatus');

class PropertyLocationController {
  /**
   * Get all locations linked to a property
   * GET /api/property/:property_id/locations
   */
  static async getPropertyLocations(req, res) {
    try {
      const { property_id } = req.params;

      const property = await Property.findOne({ where: { property_id } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Property not found');
      }

      const locations = await PropertyLocation.findAll({
        where: { property_id },
        include: [
          {
            model: Location,
            as: 'location',
            attributes: ['location_id', 'name', 'status'],
          },
        ],
        order: [['created_date', 'DESC']],
      });

      return sendSuccess(res, HTTP.OK, { locations }, 'Locations retrieved successfully');
    } catch (err) {
      console.error('[PropertyLocationController] getPropertyLocations error:', err.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Failed to fetch property locations');
    }
  }

  /**
   * Add a single location to a property
   * POST /api/property/:property_id/locations
   * Body: { location_id: string }
   */
  static async addLocationToProperty(req, res) {
    try {
      const { property_id } = req.params;
      const { location_id } = req.body;
      const userId = req.user?.user_id || 'system';

      if (!location_id) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'location_id wajib diisi');
      }

      const property = await Property.findOne({ where: { property_id } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan');
      }

      const location = await Location.findOne({ where: { location_id } });
      if (!location) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Lokasi tidak ditemukan');
      }

      const existing = await PropertyLocation.findOne({ where: { property_id, location_id } });
      if (existing) {
        return sendError(res, HTTP.CONFLICT, null, 'Lokasi sudah terhubung ke properti ini');
      }

      const propLoc = await PropertyLocation.create({
        property_id,
        location_id,
        created_date: new Date(),
        created_by: userId,
      });

      return sendSuccess(res, HTTP.CREATED, { propertyLocation: propLoc }, 'Lokasi berhasil ditambahkan ke properti');
    } catch (err) {
      console.error('[PropertyLocationController] addLocationToProperty error:', err.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menambahkan lokasi ke properti');
    }
  }

  /**
   * Remove a location from a property
   * DELETE /api/property/:property_id/locations/:location_id
   */
  static async removeLocationFromProperty(req, res) {
    try {
      const { property_id, location_id } = req.params;

      const propLoc = await PropertyLocation.findOne({ where: { property_id, location_id } });
      if (!propLoc) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Relasi properti-lokasi tidak ditemukan');
      }

      await propLoc.destroy();

      return sendSuccess(res, HTTP.OK, {}, 'Lokasi berhasil dihapus dari properti');
    } catch (err) {
      console.error('[PropertyLocationController] removeLocationFromProperty error:', err.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal menghapus lokasi dari properti');
    }
  }

  /**
   * Bulk add multiple locations to a property
   * POST /api/property/:property_id/locations/bulk
   * Body: { location_ids: string[] }
   */
  static async bulkAddLocations(req, res) {
    try {
      const { property_id } = req.params;
      const { location_ids = [] } = req.body;
      const userId = req.user?.user_id || 'system';

      if (!Array.isArray(location_ids) || location_ids.length === 0) {
        return sendError(res, HTTP.BAD_REQUEST, null, 'location_ids array wajib diisi');
      }

      const property = await Property.findOne({ where: { property_id } });
      if (!property) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Properti tidak ditemukan');
      }

      const locations = await Location.findAll({ where: { location_id: location_ids } });
      if (locations.length !== location_ids.length) {
        return sendError(res, HTTP.NOT_FOUND, null, 'Satu atau lebih lokasi tidak ditemukan');
      }

      const existing = await PropertyLocation.findAll({
        where: { property_id, location_id: location_ids },
      });
      const existingIds = existing.map(e => e.location_id);

      const newLocationIds = location_ids.filter(id => !existingIds.includes(id));

      if (newLocationIds.length === 0) {
        return sendSuccess(res, HTTP.OK, { added: 0 }, 'Semua lokasi sudah terhubung ke properti ini');
      }

      const propLocs = await PropertyLocation.bulkCreate(
        newLocationIds.map(loc_id => ({
          property_id,
          location_id: loc_id,
          created_date: new Date(),
          created_by: userId,
        }))
      );

      return sendSuccess(
        res, HTTP.CREATED,
        { added: propLocs.length, propertyLocations: propLocs },
        `${propLocs.length} lokasi berhasil ditambahkan ke properti`
      );
    } catch (err) {
      console.error('[PropertyLocationController] bulkAddLocations error:', err.message);
      return sendError(res, HTTP.INTERNAL_SERVER_ERROR, null, 'Gagal bulk tambah lokasi');
    }
  }
}

module.exports = PropertyLocationController;
