/**
 * offTopicSentinel.js — M131.
 *
 * Owner directive (23 Agu 2026): ketika AI_PRIMARY_PROVIDER bukan 'private',
 * platform API (ChatGPT/Claude/Qwen/DeepSeek/Kimi) — bukan backend — yang
 * berwenang memutuskan apakah sebuah pesan customer di luar topik properti
 * dan TIDAK PERLU dibalas sama sekali. Backend tetap menjalankan penyaring
 * kata kunci murah SEBAGAI langkah pertama (propertyKeywordFilter.js, hemat
 * token), tapi begitu pesan lolos penyaring itu dan diteruskan ke platform
 * API, keputusan akhir "diam atau balas" ada di tangan model — via skill doc
 * (`docs/09-offtopic-and-escalation.md` §3c) yang menginstruksikan model
 * membalas dengan token ini, PERSIS, tanpa teks lain, saat memutuskan diam.
 *
 * Deteksi exact-match (bukan substring) dengan sengaja: token ini hanya sah
 * bila itu SATU-SATUNYA isi balasan model, sesuai instruksi skill doc — kalau
 * model menyelipkannya di tengah kalimat lain, itu bukan sinyal diam yang sah
 * dan balasan tetap dikirim apa adanya (fail-safe ke arah "tetap balas",
 * bukan "diam-diam tak terduga").
 */
'use strict';

const OFFTOPIC_SILENT_SENTINEL = '[[OFFTOPIC_SILENT]]';

function isSilentSentinel(text) {
  if (!text) return false;
  return String(text).trim() === OFFTOPIC_SILENT_SENTINEL;
}

module.exports = { OFFTOPIC_SILENT_SENTINEL, isSilentSentinel };
