const Contact = require('./Contact');
const Log = require('./Log');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const Property = require('./Property');
const WhatsAppInbound = require('./WhatsAppInbound');
const User = require('./User');

ChatSession.hasMany(ChatMessage, { foreignKey: 'chatSessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'chatSessionId', as: 'session' });

module.exports = {
  Contact,
  Log,
  ChatSession,
  ChatMessage,
  Property,
  WhatsAppInbound,
  User
};
