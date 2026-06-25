const Contact = require('./Contact');
const Log = require('./Log');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const Property = require('./Property');
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

module.exports = {
  Contact,
  Log,
  ChatSession,
  ChatMessage,
  Property,
  WhatsAppInbound,
  User,
  Facility,
  Country,
  Province,
  City
};
