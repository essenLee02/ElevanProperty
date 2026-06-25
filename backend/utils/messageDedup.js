/**
 * messageDedup.js
 *
 * In-memory message-ID dedup guard shared by all WhatsApp controllers
 * (Fonnte, ChakraHQ, TimelinesAI). Prevents double-processing when a platform
 * retries a webhook delivery.
 *
 * Keyed by the platform's stable message id → epoch ms. TTL = 10 minutes,
 * which comfortably covers any provider retry window. Non-stable synthetic
 * ids (e.g. "fonnte_1700000000000", "wati_...") are ignored — they are unique
 * per delivery, so deduping on them would do nothing and waste memory.
 *
 * Usage:
 *   const { isAlreadyProcessed, markProcessed } = require('../utils/messageDedup');
 *   if (isAlreadyProcessed(messageId)) return;   // skip retry
 *   markProcessed(messageId);
 */

'use strict';

const _seen        = new Map();
const DEDUP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_ENTRIES  = 1000;

// Content-based dedup: prevents the same (phone, message) pair from being
// processed twice within 90 seconds. Covers Fonnte webhook double-delivery
// and polling+webhook overlap where message IDs differ but content is identical.
const _contentSeen = new Map();
const CONTENT_TTL_MS = 90 * 1000;   // 90 seconds

// Synthetic id prefixes that are NOT stable across retries — never dedup these.
const _SYNTHETIC_PREFIXES = ['fonnte_', 'wati_', 'dialog_', 'dialog360_'];

function _isSynthetic(messageId) {
  const s = String(messageId);
  return _SYNTHETIC_PREFIXES.some(p => s.startsWith(p));
}

/**
 * @param {string} messageId - platform's stable message id
 * @returns {boolean} true if this id was processed within the TTL window
 */
function isAlreadyProcessed(messageId) {
  if (!messageId || _isSynthetic(messageId)) return false;
  const ts = _seen.get(messageId);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL_MS) { _seen.delete(messageId); return false; }
  return true;
}

/**
 * Record a message id as processed. No-op for empty/synthetic ids.
 * @param {string} messageId
 */
function markProcessed(messageId) {
  if (!messageId || _isSynthetic(messageId)) return;
  _seen.set(messageId, Date.now());
  // Prune expired entries when the cache grows large.
  if (_seen.size > MAX_ENTRIES) {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [id, ts] of _seen) { if (ts < cutoff) _seen.delete(id); }
  }
}

/**
 * Content-based dedup: prevent the same (phone + message) from being processed
 * twice within CONTENT_TTL_MS (90s). Catches Fonnte duplicate webhooks where
 * message IDs differ (e.g. different inboxid per delivery).
 *
 * @param {string} phone   - Normalized sender phone
 * @param {string} content - Message content (trimmed)
 * @returns {boolean} true if this phone+content was already processed
 */
function isContentAlreadyProcessed(phone, content) {
  if (!phone || !content) return false;
  const key = `${String(phone).trim()}::${String(content).trim().slice(0, 120)}`;
  const ts = _contentSeen.get(key);
  if (!ts) return false;
  if (Date.now() - ts > CONTENT_TTL_MS) { _contentSeen.delete(key); return false; }
  return true;
}

/**
 * Record a (phone, content) pair as processed.
 * @param {string} phone
 * @param {string} content
 */
function markContentProcessed(phone, content) {
  if (!phone || !content) return;
  const key = `${String(phone).trim()}::${String(content).trim().slice(0, 120)}`;
  _contentSeen.set(key, Date.now());
  if (_contentSeen.size > MAX_ENTRIES) {
    const cutoff = Date.now() - CONTENT_TTL_MS;
    for (const [k, ts] of _contentSeen) { if (ts < cutoff) _contentSeen.delete(k); }
  }
}

module.exports = { isAlreadyProcessed, markProcessed, isContentAlreadyProcessed, markContentProcessed };
