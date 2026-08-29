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

/**
 * ⚠️ M165 — EKOR SESUDAH KARTU TERAKHIR HARUS JADI PESAN SENDIRI.
 *
 * Bug produksi (transkrip 29 Agu 2026, keluhan pemilik proyek): pemisahan di
 * atas hanya memotong pada BATAS ANTAR-KARTU. Kalimat penutup yang ditempel
 * sesudah kartu terakhir ("Ada yang menarik, Kak? Kalau mau saya carikan yang
 * lebih spesifik...") karena itu ikut menumpang di pesan kartu terakhir —
 * tidak ada kartu berikutnya untuk memicu pemotongan.
 *
 * Di WhatsApp kartu properti sudah panjang, jadi pertanyaan yang menempel di
 * ekornya TERTUTUP oleh kartu dan praktis tidak terbaca customer. Persis
 * itulah yang terjadi: customer tidak pernah menjawab pertanyaan penutupnya.
 *
 * Ekor dikenali sebagai paragraf terakhir yang BUKAN baris detail kartu:
 * baris kartu selalu diindentasi (`   📍 Lokasi: ...`), sedangkan kalimat
 * penutup rata kiri. Pemisahan hanya dilakukan bila paragraf itu benar-benar
 * ada — kartu tanpa ekor tetap utuh apa adanya.
 */
const CARD_DETAIL_LINE_RE = /^\s+\S/;

function splitTrailingNote(cardPart) {
  const paras = String(cardPart).split(/\n{2,}/);
  if (paras.length < 2) return [cardPart];

  const last = paras[paras.length - 1];
  // Paragraf ekor: tidak ada satu pun baris berindentasi (bukan detail kartu)
  // dan bukan judul kartu baru.
  const lines = last.split('\n').filter((l) => l.trim());
  if (!lines.length) return [cardPart];
  const isDetail = lines.some((l) => CARD_DETAIL_LINE_RE.test(l));
  if (isDetail || CARD_START_RE.test(last)) return [cardPart];

  const head = paras.slice(0, -1).join('\n\n').trim();
  const tail = last.trim();
  return head && tail ? [head, tail] : [cardPart];
}

function splitCatalogReply(text) {
  if (!text || typeof text !== 'string' || !CARD_START_RE.test(text)) return [text];

  const parts = text.split(CARD_BOUNDARY_RE).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return [text];

  // Hanya bagian TERAKHIR yang bisa membawa ekor — bagian lain diakhiri oleh
  // kartu berikutnya, jadi tidak pernah punya paragraf menggantung.
  const out = parts.slice(0, -1);
  out.push(...splitTrailingNote(parts[parts.length - 1]));
  return out;
}

module.exports = { splitCatalogReply };
