'use strict';

/**
 * Splits a combined "summary brief + catalog listing" WhatsApp reply into
 * separate messages: one for the summary/lead-in text, then one per numbered
 * property card (matches both Private Agent's `1. *Title*` and the AI skill-doc
 * template `1. **Title**`).
 *
 * If no numbered card is found — e.g. the "no catalog match" apology, which is
 * intentionally kept combined with the summary in a single message — the text
 * is returned unsplit.
 */
const CARD_START_RE = /\d+\.\s+\*{1,2}/;
const CARD_BOUNDARY_RE = /\n{2,}(?=\d+\.\s+\*{1,2})/;

function splitCatalogReply(text) {
  if (!text || typeof text !== 'string' || !CARD_START_RE.test(text)) return [text];

  const parts = text.split(CARD_BOUNDARY_RE).map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

module.exports = { splitCatalogReply };
