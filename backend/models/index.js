const Contact = require('./Contact');
const Log = require('./Log');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const Property = require('./Property');
const WhatsAppInbound = require('./WhatsAppInbound');
const User = require('./User');
const Facility = require('./Facility');

ChatSession.hasMany(ChatMessage, { foreignKey: 'chatSessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'chatSessionId', as: 'session' });

// Facility ↔ User FK associations (informational — no cascade enforced at app level)
Facility.belongsTo(User, { foreignKey: 'created_by', targetKey: 'user_id', as: 'creator', constraints: false });
Facility.belongsTo(User, { foreignKey: 'updated_by', targetKey: 'user_id', as: 'updater', constraints: false });

module.exports = {
  Contact,
  Log,
  ChatSession,
  ChatMessage,
  Property,
  WhatsAppInbound,
  User,
  Facility
};
