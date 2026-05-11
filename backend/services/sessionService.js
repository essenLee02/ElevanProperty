const { ChatSession, ChatMessage } = require('../models');
const normalizeName = require('../utils/normalizeName');
const { normalizePhone } = require('../utils/normalizePhone');

async function findOrCreateSession(name, phone, source = 'website_chatbot') {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);

  let session = await ChatSession.findOne({ where: { normalizedPhone } });
  if (!session) {
    session = await ChatSession.create({
      name: String(name || '').trim(),
      normalizedName,
      phone: String(phone || '').trim(),
      normalizedPhone,
      source,
      lastMessageAt: new Date()
    });
  } else {
    await session.update({
      name: session.name || String(name || '').trim(),
      normalizedName: session.normalizedName || normalizedName,
      phone: session.phone || String(phone || '').trim(),
      source: session.source || source,
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
    createdAt: item.createdAt
  }));
}

async function saveUserMessage(sessionId, message, channel = 'website_chatbot', metadata = null) {
  return ChatMessage.create({
    chatSessionId: sessionId,
    role: 'user',
    message,
    channel,
    metadata: metadata ? JSON.stringify(metadata) : null
  });
}

async function saveAssistantMessage(sessionId, message, channel = 'website_chatbot', metadata = null) {
  return ChatMessage.create({
    chatSessionId: sessionId,
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
  saveAssistantMessage
};
