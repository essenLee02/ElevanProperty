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

/** Read CHATBOT_COOKIE_TTL_MINUTES from env (same clamping logic as chatbotController). */
function _cookieTtlMs() {
  const mins = Number(process.env.CHATBOT_COOKIE_TTL_MINUTES || 20);
  const clamped = Number.isFinite(mins) && mins > 0
    ? Math.min(Math.max(Math.round(mins), 1), 1440)
    : 20;
  return clamped * 60 * 1000;
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

  // ── Server-side TTL enforcement ───────────────────────────────────────────
  // If a session exists but the last activity was longer ago than the TTL,
  // the session is expired. Null it out so a fresh session is created below,
  // giving the customer an empty history → Q1 is asked again from scratch.
  // This mirrors what the frontend cookie expiry does client-side, but ensures
  // the backend also resets when the customer returns after a long pause.
  if (session && session.lastMessageAt) {
    const idleMs = Date.now() - new Date(session.lastMessageAt).getTime();
    if (idleMs > _cookieTtlMs()) {
      console.log(`[SessionService] Session ${session.id} expired (idle ${Math.round(idleMs / 60000)} min > TTL ${Math.round(_cookieTtlMs() / 60000)} min) — creating fresh session.`);
      session = null;  // triggers CREATE below → empty history → Q1 restart
    }
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
  // ⚠️ M160: `id DESC` DITAMBAHKAN sebagai tiebreaker kedua — TEMUAN NYATA,
  // bukan kehati-hatian teoretis. `chat_messages.createdAt` adalah DATETIME
  // MySQL polos (presisi DETIK, bukan milidetik). Customer yang mengetik dua
  // pesan berurutan dalam detik yang sama (sangat umum — transkrip produksi
  // 28 Agu 2026 penuh pesan beruntun: "Minta listing" lalu "Sya ini dr td
  // minta listing" dalam hitungan detik) menghasilkan createdAt yang IDENTIK.
  // ORDER BY createdAt SAJA pada baris yang timestamp-nya sama TIDAK dijamin
  // urutan insersi oleh MySQL — diverifikasi langsung: sebuah transkrip 4
  // giliran percakapan kembali dari query ini dalam urutan ACAK, bukan
  // kronologis. Setiap detektor yang bergantung pada "pesan AI TERAKHIR"
  // (lastAiMessageAsksQuestion, extractQualificationState, gerbang
  // ketersediaan area M152-M160, dst.) rusak diam-diam saat ini terjadi.
  // `id` autoincrement SELALU monoton mengikuti urutan insersi terlepas dari
  // presisi timestamp, jadi dipakai sebagai tiebreaker pasti.
  const messages = await ChatMessage.findAll({
    where: { chatSessionId: sessionId },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit
  });

  // ── TTL memori percakapan (CHATBOT_COOKIE_TTL_MINUTES) ────────────────────
  // Bila pesan TERAKHIR lebih tua dari TTL → seluruh history dianggap
  // kedaluwarsa/dilupakan (return []). Customer yang kembali setelah jeda
  // panjang diperlakukan sebagai percakapan baru: gate Q1-4 dievaluasi dari
  // nol dan status dorman pasca-summary ikut ter-reset. Idle-based (jeda sejak
  // pesan terakhir), BUKAN umur pesan — percakapan panjang yang masih aktif
  // tidak kehilangan awal obrolannya.
  if (messages.length) {
    const idleMs = Date.now() - new Date(messages[0].createdAt).getTime();
    if (idleMs > _cookieTtlMs()) {
      console.log(`[SessionService] History session ${sessionId} dilupakan (idle ${Math.round(idleMs / 60000)} mnt > TTL ${Math.round(_cookieTtlMs() / 60000)} mnt) — mulai fresh.`);
      return [];
    }
  }

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
