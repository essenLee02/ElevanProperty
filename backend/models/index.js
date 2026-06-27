const Contact = require('./Contact');
const Log = require('./Log');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const Property = require('./Property');
const PropertyImage = require('./PropertyImage');
const PropertyFacility = require('./PropertyFacility');
const WhatsAppInbound = require('./WhatsAppInbound');
const User = require('./User');
const Facility = require('./Facility');
const Country = require('./Country');
const Province = require('./Province');
const City = require('./City');

ChatSession.hasMany(ChatMessage, { foreignKey: 'chatSessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'chatSessionId', as: 'session' });

// Facility ↔ User FK associations (informational — no cascade enforced at app level)
Facility.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator', constraints: false });
Facility.belongsTo(User, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater', constraints: false });

// Region hierarchy: Country → Province → City (informational FK, no cascade enforced)
Country.hasMany(Province, { foreignKey: 'country_id', sourceKey: 'country_id', as: 'provinces', constraints: false });
Province.belongsTo(Country, { foreignKey: 'country_id', targetKey: 'country_id', as: 'country', constraints: false });

Province.hasMany(City, { foreignKey: 'province_id', sourceKey: 'province_id', as: 'cities', constraints: false });
City.belongsTo(Province, { foreignKey: 'province_id', targetKey: 'province_id', as: 'province', constraints: false });
City.belongsTo(Country,  { foreignKey: 'country_id',  targetKey: 'country_id',  as: 'country',  constraints: false });

// Property header → region (informational FK, no cascade enforced)
Property.belongsTo(City,     { foreignKey: 'city_id',     targetKey: 'city_id',     as: 'city',     constraints: false });
Property.belongsTo(Province, { foreignKey: 'province_id', targetKey: 'province_id', as: 'province', constraints: false });
Property.belongsTo(Country,  { foreignKey: 'country_id',  targetKey: 'country_id',  as: 'country',  constraints: false });

// Property header → detail (gambar & fasilitas) — relasi 1-ke-banyak via property_id
Property.hasMany(PropertyImage,    { foreignKey: 'property_id', sourceKey: 'property_id', as: 'images',     constraints: false });
PropertyImage.belongsTo(Property,  { foreignKey: 'property_id', targetKey: 'property_id', as: 'property',   constraints: false });

Property.hasMany(PropertyFacility,   { foreignKey: 'property_id', sourceKey: 'property_id', as: 'facilities', constraints: false });
PropertyFacility.belongsTo(Property, { foreignKey: 'property_id', targetKey: 'property_id', as: 'property',   constraints: false });
PropertyFacility.belongsTo(Facility, { foreignKey: 'facility_id', targetKey: 'facility_id', as: 'facility',   constraints: false });

module.exports = {
  Contact,
  Log,
  ChatSession,
  ChatMessage,
  Property,
  PropertyImage,
  PropertyFacility,
  WhatsAppInbound,
  User,
  Facility,
  Country,
  Province,
  City
};
