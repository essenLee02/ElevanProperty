/**
 * apifyService.js
 *
 * Wraps the Apify ApifyClient to run the Rumah123 scraper actor and retrieve datasets.
 *
 * Architecture: single class ApifyRumah123Service with all logic as static methods.
 * Module exports use the same function names as before for backward compatibility.
 */

const { ApifyClient } = require('apify-client');

// ─── ApifyRumah123Service ─────────────────────────────────────────────────────

class ApifyRumah123Service {
  /** Apify actor ID for the Rumah123 scraper */
  static #ACTOR_ID = 'fatihtahta/rumah123-scraper';

  /**
   * Create and return an ApifyClient using the token from environment variables.
   * Throws if APIFY_API_TOKEN is not configured.
   */
  static #createClient() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) throw new Error('APIFY_API_TOKEN not found in .env');
    return new ApifyClient({ token });
  }

  /**
   * Build the Apify actor input object from search parameters.
   * Maps camelCase params to the snake_case keys expected by the actor.
   *
   * @param {object} params - Search parameters
   * @returns {object} Actor input payload
   */
  static #buildInput(params) {
    const input = {
      listingType:           params.listingType          || 'sale',
      sortOrder:             params.sortOrder            || 'recommended',
      promotions:            params.promotions           || [],
      'property-type':       params.propertyType         || [],
      furninshing_condition: params.furnishingCondition  || [],
      property_facilities:   params.facilities           || [],
      limit:                 params.limit                || 20,
    };

    // Apply optional numeric/string filters only when provided
    if (params.location)        input.location          = params.location;
    if (params.minPrice)        input.min_price         = parseInt(params.minPrice);
    if (params.maxPrice)        input.max_price         = parseInt(params.maxPrice);
    if (params.minBedrooms)     input.min_bedrooms      = String(params.minBedrooms);
    if (params.minBathrooms)    input.min_bathrooms     = String(params.minBathrooms);
    if (params.minFloors)       input.min_floors        = String(params.minFloors);
    if (params.minLandSize)     input.min_land_size     = parseInt(params.minLandSize);
    if (params.maxLandSize)     input.max_land_size     = parseInt(params.maxLandSize);
    if (params.minBuildingSize) input.min_building_size = parseInt(params.minBuildingSize);
    if (params.maxBuildingSize) input.max_building_size = parseInt(params.maxBuildingSize);
    if (params.startUrls?.length) input.startUrls       = params.startUrls;

    return input;
  }

  /**
   * Transform a raw Apify listing item into a clean, flat object.
   * Normalises missing fields to safe defaults.
   *
   * @param {object} item - Raw listing item from Apify dataset
   * @returns {object} Transformed listing
   */
  static transformListing(item) {
    return {
      id:           item.id,
      url:          item.url           || '',
      title:        item.title         || '',
      price:        item.price         || '',
      priceNumeric: item.priceNumeric  || 0,
      currency:     item.currency      || 'IDR',
      propertyType: item.propertyType  || '',
      listingType:  item.listingType   || '',
      location:     item.location      || '',
      province:     item.province      || '',
      city:         item.city          || '',
      district:     item.district      || '',
      bedrooms:     item.bedrooms      || 0,
      bathrooms:    item.bathrooms     || 0,
      landSize:     item.landSize      || 0,
      buildingSize: item.buildingSize  || 0,
      furnishing:   item.furnishing    || '',
      condition:    item.condition     || '',
      certificate:  item.certificate   || '',
      facilities:   item.facilities    || [],
      mediaUrls:    item.mediaUrls     || [],
      agentName:    item.agentName     || '',
      agentPhone:   item.agentPhone    || '',
      agentWhatsapp:item.agentWhatsapp || '',
      agencyName:   item.agencyName    || '',
      publishedAt:  item.publishedAt   || '',
      coordinates: {
        lat: item.latitude  || null,
        lng: item.longitude || null,
      },
      installments: item.installments  || [],
    };
  }

  /**
   * Run the Rumah123 scraper actor on Apify and wait for it to finish.
   * Returns all items plus metadata (runId, datasetId, totalItems).
   *
   * @param {object} params - Search parameters (see #buildInput for fields)
   * @returns {Promise<{ items: object[], runId: string, datasetId: string, totalItems: number }>}
   */
  static async scrape(params = {}) {
    const client = this.#createClient();
    const input  = this.#buildInput(params);

    console.log('[Apify] Starting Rumah123 scraper:', JSON.stringify(input, null, 2));

    const run = await client.actor(this.#ACTOR_ID).call(input);

    console.log(`[Apify] Run completed. Dataset ID: ${run.defaultDatasetId}`);
    console.log(`[Apify] View at: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`[Apify] Retrieved ${items.length} listings`);

    return {
      items,
      runId:      run.id,
      datasetId:  run.defaultDatasetId,
      totalItems: items.length,
    };
  }

  /**
   * Retrieve items from an existing Apify dataset without re-running the actor.
   * Supports pagination via offset / limit options.
   *
   * @param {string} datasetId  - Dataset ID from a previous run
   * @param {object} options    - { offset?: number, limit?: number }
   * @returns {Promise<{ items: object[], total: number }>}
   */
  static async getDataset(datasetId, options = {}) {
    const client = this.#createClient();
    const { items, total } = await client.dataset(datasetId).listItems({
      offset: options.offset || 0,
      limit:  options.limit  || 50,
    });
    return { items, total };
  }
}

// ─── Exports (backward-compatible function wrappers) ──────────────────────────

module.exports = {
  scrapeRumah123:  (params)         => ApifyRumah123Service.scrape(params),
  getDatasetItems: (id, opts)       => ApifyRumah123Service.getDataset(id, opts),
  transformListing:(item)           => ApifyRumah123Service.transformListing(item),
};
