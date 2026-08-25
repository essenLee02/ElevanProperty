const Contact = require('./Contact');
const Log = require('./Log');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const Property = require('./Property');
const PropertyImage = require('./PropertyImage');
const PropertyFacility = require('./PropertyFacility');
const PropertyLocation = require('./PropertyLocation');
const User = require('./User');
const Facility = require('./Facility');
const Country = require('./Country');
const Province = require('./Province');
const City = require('./City');
const Location = require('./Location');
const Customer = require('./Customer');
const DeveloperProperty = require('./DeveloperProperty');

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

// Customer ↔ User (agent) — 1 customer bisa terdaftar ke beberapa agent (baris per agent)
Customer.belongsTo(User, { foreignKey: 'user_id',    targetKey: 'user_id', as: 'agent',   constraints: false });
Customer.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator', constraints: false });
User.hasMany(Customer,   { foreignKey: 'user_id',    sourceKey: 'user_id', as: 'customers', constraints: false });

// User (agent) → DeveloperProperty (brand agensi tempat agent bernaung).
// constraints:false mengikuti pola SELURUH asosiasi di file ini — FK bersifat
// INFORMASIONAL di level aplikasi, tidak ditegakkan DB, supaya data lama yang
// belum dipetakan (developer_property_id = null) tidak memblokir boot/sync.
User.belongsTo(DeveloperProperty, { foreignKey: 'developer_property_id', targetKey: 'developer_property_id', as: 'developerProperty', constraints: false });
DeveloperProperty.hasMany(User,   { foreignKey: 'developer_property_id', sourceKey: 'developer_property_id', as: 'agents',            constraints: false });
DeveloperProperty.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator', constraints: false });
DeveloperProperty.belongsTo(User, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater', constraints: false });

// Property → Location relationship (many-to-many through property_locations table)
Property.hasMany(PropertyLocation,  { foreignKey: 'property_id', sourceKey: 'property_id', as: 'locations', constraints: false });
PropertyLocation.belongsTo(Property, { foreignKey: 'property_id', targetKey: 'property_id', as: 'property',  constraints: false });
PropertyLocation.belongsTo(Location, { foreignKey: 'location_id', targetKey: 'location_id', as: 'location',  constraints: false });
Location.hasMany(PropertyLocation,   { foreignKey: 'location_id', sourceKey: 'location_id', as: 'properties', constraints: false });

module.exports = {
  Contact,
  Log,
  ChatSession,
  ChatMessage,
  Property,
  PropertyImage,
  PropertyFacility,
  PropertyLocation,
  User,
  Facility,
  Country,
  Province,
  City,
  Location,
  Customer,
  DeveloperProperty
};
