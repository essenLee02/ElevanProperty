/**
 * messageDedup.js
 *
 * In-memory message-ID dedup guard shared by all WhatsApp controllers
 * (Fonnte, WATI, 360dialog). Prevents double-processing when a platform
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

module.exports = { isAlreadyProcessed, markProcessed };
