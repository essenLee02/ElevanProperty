const { ChatSession, ChatMessage } = require('../models');
const normalizeName = require('../utils/normalizeName');
const { normalizePhone } = require('../utils/normalizePhone');

function normalizeLocation(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveLocationAndSource(locationOrSource = '', sourceMaybe = '') {
  const knownSources = ['website_chatbot', 'contact_form', 'whatsapp_fonnte', 'whatsapp', 'whatsapp_kirimi', 'whatsapp_timelinesai'];
  const third = String(locationOrSource || '').trim();
  const fourth = String(sourceMaybe || '').trim();

  // Backward compatibility for old calls: findOrCreateSession(name, phone, source)
  if (!fourth && knownSources.includes(third)) {
    return { location: '', source: third };
  }

  return {
    location: third,
    source: fourth || 'website_chatbot'
  };
}

async function findOrCreateSession(name, phone, locationOrSource = '', sourceMaybe = '') {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  const { location, source } = resolveLocationAndSource(locationOrSource, sourceMaybe);
  const normalizedLocation = normalizeLocation(location);

  const where = normalizedLocation
    ? { normalizedName, normalizedPhone, normalizedLocation }
    : { normalizedPhone };

  let session = await ChatSession.findOne({ where });

  // Fallback: if a returning customer did not previously have location saved,
  // reconnect by phone and name, then update the location.
  if (!session && normalizedLocation) {
    session = await ChatSession.findOne({ where: { normalizedName, normalizedPhone } });
  }

  if (!session) {
    session = await ChatSession.create({
      name: String(name || '').trim(),
      normalizedName,
      phone: String(phone || '').trim(),
      normalizedPhone,
      location: String(location || '').trim(),
      normalizedLocation,
      source,
      lastMessageAt: new Date()
    });
  } else {
    await session.update({
      name: String(name || '').trim() || session.name,
      normalizedName: normalizedName || session.normalizedName,
      phone: String(phone || '').trim() || session.phone,
      location: String(location || '').trim() || session.location,
      normalizedLocation: normalizedLocation || session.normalizedLocation,
      source: source || session.source,
      lastMessageAt: new Date()
    });
  }

  return session;
}

async function getConversationHistory(sessionId, limit = 12) {
  const messages = await ChatMessage.findAll({
    where: { chatSessionId: sessionId },
    order: [['createdAt', 'DESC']],
    limit
  });

  return messages.reverse().map((item) => ({
    role: item.role,
    message: item.message,
    channel: item.channel,
    metadata: item.metadata,
    createdAt: item.createdAt
  }));
}

async function saveUserMessage(sessionId, message, channel = 'website_chatbot', metadata = null, userId = null) {
  return ChatMessage.create({
    chatSessionId: sessionId,
    user_id: userId,
    role: 'user',
    message,
    channel,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
}

async function saveAssistantMessage(sessionId, message, channel = 'website_chatbot', metadata = null, userId = null) {
  return ChatMessage.create({
    chatSessionId: sessionId,
    user_id: userId,
    role: 'assistant',
    message,
    channel,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
}

module.exports = {
  findOrCreateSession,
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage,
  normalizeLocation
};
