const { scrapeRumah123, getDatasetItems, transformListing } = require('../services/apifyService');
const { getCacheStatus, warmupCache } = require('../services/rumah123ContextService');
const { HTTP } = require('../config/httpStatus');

/**
 * GET /api/rumah123/search
 * Search property listings dari Rumah123 via Apify
 */
async function search(req, res) {
  try {
    const {
      listingType = 'sale',
      location = '',
      sortOrder = 'recommended',
      propertyType,          // comma-separated: house,apartment
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      furnishingCondition,   // comma-separated: fully-furnished
      facilities,            // comma-separated: parking,wifi
      minLandSize,
      maxLandSize,
      minBuildingSize,
      maxBuildingSize,
      limit = 20,
      raw = false,           // jika true, return raw data dari Apify
    } = req.query;

    // Validasi listingType
    if (!['sale', 'rent'].includes(listingType)) {
      return res.status(HTTP.BAD_REQUEST).json({
        success: false,
        error: 'listingType harus "sale" atau "rent"'
      });
    }

    // Validasi limit
    const limitNum = Math.min(parseInt(limit) || 20, 200);

    const params = {
      listingType,
      location,
      sortOrder,
      limit: limitNum,
    };

    if (propertyType) params.propertyType = propertyType.split(',').map(s => s.trim());
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (minBedrooms) params.minBedrooms = minBedrooms;
    if (minBathrooms) params.minBathrooms = minBathrooms;
    if (furnishingCondition) params.furnishingCondition = furnishingCondition.split(',').map(s => s.trim());
    if (facilities) params.facilities = facilities.split(',').map(s => s.trim());
    if (minLandSize) params.minLandSize = minLandSize;
    if (maxLandSize) params.maxLandSize = maxLandSize;
    if (minBuildingSize) params.minBuildingSize = minBuildingSize;
    if (maxBuildingSize) params.maxBuildingSize = maxBuildingSize;

    console.log(`[Rumah123] Search request:`, params);

    const result = await scrapeRumah123(params);

    // Transform data jika tidak minta raw
    const listings = raw === 'true'
      ? result.items
      : result.items.map(transformListing);

    res.json({
      success: true,
      data: {
        listings,
        meta: {
          total: result.totalItems,
          runId: result.runId,
          datasetId: result.datasetId,
          params,
        }
      }
    });
  } catch (error) {
    console.error('[Rumah123] Search error:', error.message);
    res.status(HTTP.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
      hint: error.message.includes('APIFY_API_TOKEN')
        ? 'Tambahkan APIFY_API_TOKEN ke file .env'
        : undefined
    });
  }
}

/**
 * POST /api/rumah123/search
 * Search dengan body JSON (lebih detail, untuk Postman)
 */
async function searchPost(req, res) {
  try {
    const {
      listingType = 'sale',
      location = '',
      sortOrder = 'recommended',
      propertyType = [],
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      furnishingCondition = [],
      facilities = [],
      minLandSize,
      maxLandSize,
      minBuildingSize,
      maxBuildingSize,
      startUrls = [],
      limit = 20,
      raw = false,
    } = req.body;

    const limitNum = Math.min(parseInt(limit) || 20, 200);

    const params = {
      listingType,
      location,
      sortOrder,
      propertyType,
      furnishingCondition,
      facilities,
      limit: limitNum,
    };

    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (minBedrooms) params.minBedrooms = String(minBedrooms);
    if (minBathrooms) params.minBathrooms = String(minBathrooms);
    if (minLandSize) params.minLandSize = minLandSize;
    if (maxLandSize) params.maxLandSize = maxLandSize;
    if (minBuildingSize) params.minBuildingSize = minBuildingSize;
    if (maxBuildingSize) params.maxBuildingSize = maxBuildingSize;
    if (startUrls.length > 0) params.startUrls = startUrls;

    console.log(`[Rumah123] POST Search request:`, params);

    const result = await scrapeRumah123(params);

    const listings = raw
      ? result.items
      : result.items.map(transformListing);

    res.json({
      success: true,
      data: {
        listings,
        meta: {
          total: result.totalItems,
          runId: result.runId,
          datasetId: result.datasetId,
          params,
        }
      }
    });
  } catch (error) {
    console.error('[Rumah123] Search POST error:', error.message);
    res.status(HTTP.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: error.message,
      hint: error.message.includes('APIFY_API_TOKEN')
        ? 'Tambahkan APIFY_API_TOKEN ke file .env'
        : undefined
    });
  }
}

/**
 * GET /api/rumah123/dataset/:datasetId
 * Ambil hasil dari dataset Apify yang sudah ada (tanpa run ulang)
 */
async function getDataset(req, res) {
  try {
    const { datasetId } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    const result = await getDatasetItems(datasetId, {
      offset: parseInt(offset),
      limit: Math.min(parseInt(limit), 200),
    });

    const listings = result.items.map(transformListing);

    res.json({
      success: true,
      data: {
        listings,
        meta: {
          total: result.total,
          offset: parseInt(offset),
          limit: parseInt(limit),
          datasetId,
        }
      }
    });
  } catch (error) {
    console.error('[Rumah123] Get dataset error:', error.message);
    res.status(HTTP.INTERNAL_SERVER_ERROR).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/rumah123/status
 * Cek status API token Apify
 */
async function status(req, res) {
  const token = process.env.APIFY_API_TOKEN;
  res.json({
    success: true,
    data: {
      apifyTokenConfigured: Boolean(token),
      actorId: 'fatihtahta/rumah123-scraper',
      pricingPerResults: '$1.50 / 1,000 results',
      supportedListingTypes: ['sale', 'rent'],
      supportedPropertyTypes: ['house', 'apartment', 'land', 'shophouse', 'factory', 'office', 'commercial-space', 'warehouse', 'villa', 'boarding-house', 'hotel'],
    }
  });
}

/**
 * GET /api/rumah123/cache-status
 * Lihat status cache chatbot untuk Rumah123 live data
 */
async function cacheStatus(req, res) {
  const status = getCacheStatus();
  res.json({ success: true, data: status });
}

/**
 * POST /api/rumah123/warmup
 * Trigger warmup cache untuk lokasi-lokasi umum
 */
async function triggerWarmup(req, res) {
  const { locations = ['Jakarta Selatan', 'Surabaya', 'Bandung', 'Bali'] } = req.body;
  warmupCache(locations);
  res.json({ success: true, message: `Warmup triggered for ${locations.length} locations`, locations });
}

module.exports = { search, searchPost, getDataset, status, cacheStatus, triggerWarmup };
