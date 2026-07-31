/**
 * viewingScheduleTrigger.js
 *
 * Bridges the WhatsApp AI qualification flow to Google Calendar: when the AI
 * captures a GENUINE, bookable viewing date+time from the conversation, this
 * creates the calendar event automatically — no separate manual step.
 *
 * Etiquette (per product spec, 28 Jul 2026):
 *   1. Concrete viewing date+time captured →
 *   2. Check customers.email. If present → use it directly, no need to ask.
 *   3. If absent → the existing Q_EMAIL question (buildIdentityQuestion in
 *      chatbotPrivateController.js) already asks, with an explicit non-forcing
 *      opt-out ("balas 'lewati' saja — tidak wajib"). This module does NOT ask
 *      again or push back if the customer declines — it just proceeds with
 *      whatever email is available (possibly none).
 *   4. users.email (agent) is ALWAYS included as an attendee — the agent is
 *      never optional the way the customer's email is.
 *   5. Customer's display name: whatever is on file in customers.name, which
 *      itself already defaults to the WhatsApp push-name until the customer
 *      volunteers a real one (see M31/M34 in the project context) — this
 *      module does not duplicate that name-collection logic, only reads it.
 *
 * Called from the 3 WhatsApp controllers (fonnte/kirimi/timelinesAI) right next
 * to syncCustomerFromChat — same non-fatal, fire-and-forget pattern, so it
 * benefits every AI provider and every qualification flow uniformly instead of
 * being wired into just one internal code path.
 */

'use strict';

const { ConversationQualifier } = require('../controllers/chatbotPrivateController');
const { extractPropertyFilters } = require('./propertyRecommendationService');
const { scheduleViewing } = require('./googleCalendarService');

/**
 * Has a calendar event already been created for THIS exact date+time in the
 * active session? Looks for a `role: 'system'` marker message this module
 * writes after a successful booking (see below).
 *
 * `role: 'system'` is deliberately NOT 'user'/'customer'/'assistant'/'ai' — the
 * aiText/custText scanners used everywhere else in the qualification flow only
 * match those four role values, so this marker can never accidentally trip an
 * unrelated aiAskedX/hasX detector. It still flows through getConversationHistory
 * (no role filter there), so it is a normal, persistent part of `history` for
 * this module's own dedup check.
 */
function alreadyScheduledFor(history, dateString, timeString) {
  const marker = `CALENDAR_EVENT_CREATED|${dateString}|${timeString}`;
  return (history || []).some(
    (m) => m.role === 'system' && String(m.message || '').includes(marker)
  );
}

/**
 * @param {object} params
 * @param {string}   params.currentMessage - Latest customer message
 * @param {number}   params.sessionId      - chat_sessions.id — history is fetched internally
 *                                            (same self-contained shape as syncCustomerFromChat,
 *                                            so call sites don't need `history` already in scope)
 * @param {string}   params.agentUserId    - users.user_id
 * @param {string}   params.agentEmail     - users.email (may be null — booking is skipped without it, same as the REST endpoint)
 * @param {string}   params.agentName      - users.name
 * @param {string}   params.phone          - customer WhatsApp number
 * @param {string}   params.waName         - WhatsApp push-name (fallback display name)
 * @returns {Promise<{scheduled:boolean, reason?:string, result?:object}>}
 */
async function maybeScheduleViewingFromChat({
  currentMessage = '', sessionId, agentUserId, agentEmail, agentName, phone, waName,
}) {
  try {
    if (!agentEmail) return { scheduled: false, reason: 'NO_AGENT_EMAIL' };
    if (!sessionId) return { scheduled: false, reason: 'NO_SESSION_ID' };

    let history = [];
    try {
      const { getConversationHistory } = require('./sessionService');
      history = await getConversationHistory(sessionId, 60);
    } catch (_e) { /* proceed with empty history — same fail-open as syncCustomerFromChat */ }

    const filters = extractPropertyFilters(currentMessage, history);
    const profile = ConversationQualifier.buildProfile(history, currentMessage, filters);

    const dt = ConversationQualifier.extractConcreteViewingDateTime(profile);
    if (!dt) return { scheduled: false, reason: 'NO_CONCRETE_DATETIME' };

    if (alreadyScheduledFor(history, dt.dateString, dt.timeString)) {
      return { scheduled: false, reason: 'ALREADY_SCHEDULED' };
    }

    // ── Resolve customer email: THIS message first (customer may have just given
    //    it), else whatever is already on file in customers.email. Never ask here
    //    — that is buildIdentityQuestion's job, already wired into the Q-flow.
    let customerEmail = null;
    let customerName = waName || 'Customer';
    try {
      const { extractIdentityFromChat, getIdentityStatus } = require('./customerRegistrationService');
      const identity = extractIdentityFromChat(history, currentMessage);
      let dbStatus = { email: null, name: null };
      if (agentUserId && phone) {
        dbStatus = await getIdentityStatus({ agentUserId, phone, waName });
      }
      customerEmail = identity.email || dbStatus.email || null;
      customerName = identity.name || dbStatus.name || waName || 'Customer';
    } catch (_e) { /* fail-open — proceed with WA push-name, no customer email */ }

    const result = await scheduleViewing({
      agentEmail,
      agentName: agentName || 'Agen Properti',
      customerName,
      customerEmail,
      dateString: dt.dateString,
      timeString: dt.timeString,
      propertyAddress: filters.location || 'TBD',
      propertyType: filters.buildingType || 'properti',
      transactionType: filters.transactionType === 'sale' ? 'sale' : (filters.transactionType === 'rent' ? 'rent' : 'rent'),
    });

    if (!result.success) {
      console.warn('[ViewingScheduleTrigger] ⚠️ Calendar event NOT created:', result.error, '-', result.message);
      return { scheduled: false, reason: result.error, result };
    }

    console.log('[ViewingScheduleTrigger] ✅ Calendar event created:', {
      dateString: dt.dateString, timeString: dt.timeString,
      agentEmail, customerEmail: customerEmail || '(none)', eventId: result.eventId,
    });

    // ── Persist the dedup marker (see alreadyScheduledFor above) ─────────────
    if (sessionId) {
      try {
        const ChatMessage = require('../models/ChatMessage');
        await ChatMessage.create({
          chatSessionId: sessionId,
          user_id: agentUserId || null,
          role: 'system',
          message: `[SYSTEM] CALENDAR_EVENT_CREATED|${dt.dateString}|${dt.timeString} — `
            + `Jadwal viewing tersimpan di Google Calendar (eventId: ${result.eventId}).`,
          channel: 'whatsapp',
          metadata: JSON.stringify({
            system: true, calendarEvent: true,
            eventId: result.eventId, dateString: dt.dateString, timeString: dt.timeString,
          }),
        });
      } catch (dbErr) {
        console.warn('[ViewingScheduleTrigger] Failed to persist dedup marker (non-fatal):', dbErr.message);
      }
    }

    return { scheduled: true, result };
  } catch (err) {
    console.warn('[ViewingScheduleTrigger] Unhandled error (non-fatal):', err.message);
    return { scheduled: false, reason: 'UNHANDLED_ERROR' };
  }
}

module.exports = { maybeScheduleViewingFromChat, alreadyScheduledFor };
