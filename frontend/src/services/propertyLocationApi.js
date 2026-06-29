import api from './api';

/**
 * Get all locations linked to a property
 */
export const getPropertyLocations = (propertyId) => {
  return api.get(`/property/${propertyId}/locations`).then(r => r.data);
};

/**
 * Add a single location to a property
 */
export const addLocationToProperty = (propertyId, locationId) => {
  return api.post(`/property/${propertyId}/locations`, { location_id: locationId }).then(r => r.data);
};

/**
 * Add multiple locations to a property (bulk)
 */
export const bulkAddLocations = (propertyId, locationIds) => {
  return api.post(`/property/${propertyId}/locations/bulk`, {
    location_ids: Array.isArray(locationIds) ? locationIds : [locationIds]
  }).then(r => r.data);
};

/**
 * Remove a location from a property
 */
export const removeLocationFromProperty = (propertyId, locationId) => {
  return api.delete(`/property/${propertyId}/locations/${locationId}`).then(r => r.data);
};
