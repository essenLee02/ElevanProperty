'use strict';
/**
 * guardrailPolicy.js — DUA PROFIL GUARDRAIL: 'local' vs 'platform' (M133)
 *
 * Directive pemilik proyek (24 Agu 2026), penegasan & perluasan M131:
 *
 *   "Buatkan guardrails untuk local dan platform; kalau local tetapkan sesuai
 *    code seperti biasanya, namun yang platform hanya untuk deteksi awal; agar
 *    AI tidak menghabiskan banyak token. Jika chat lolos dari guardrails, maka
 *    semua keputusan diserahkan ke platform AI."
 *
 * ── PROFIL 'local' (AI_PRIMARY_PROVIDER = 'private') ───────────────────────
 * Tidak ada platform AI di belakang. chatbotPrivateController.js + seluruh
 * services/utils/controllers yang MENENTUKAN respons. Guardrail bekerja PENUH
 * seperti biasa, TERMASUK menyusun balasan redirect off-topic sendiri —
 * karena memang tidak ada pihak lain yang bisa menyusunnya.
 *
 * ── PROFIL 'platform' (primary = chatgpt|kimi|claude|qwen|deepseek|openrouter)
 * Platform AI adalah WEWENANG AKHIR balas/diam (M131). Guardrail di sini
 * TURUN PERAN jadi SEKADAR PENYARING AWAL YANG MURAH — tujuannya SATU:
 * menghemat token dengan tidak melempar sampah yang jelas-jelas bukan chat
 * (broadcast, notifikasi sistem, string acak) ke API berbayar.
 *
 * Yang BERUBAH di profil 'platform':
 *   1. Backend TIDAK menyusun balasan redirect off-topic sendiri. Pesan yang
 *      lolos diserahkan ke platform AI, yang memutuskan membalas ATAU diam
 *      lewat sentinel `[[OFFTOPIC_SILENT]]` sesuai skill doc §3c.
 *   2. Ambang lolos SENGAJA LEBIH LONGGAR (fail-OPEN). Kalau ragu → teruskan
 *      ke platform AI. Alasannya: menahan pesan properti yang sah jauh lebih
 *      merugikan (customer tidak dibalas sama sekali — kelas bug M95/M87/M88
 *      yang berulang tiga kali di proyek ini) daripada menghabiskan token
 *      untuk satu pesan yang ternyata off-topic.
 *
 * ⛔ YANG TIDAK BERUBAH DI KEDUA PROFIL (keputusan eksplisit pemilik proyek,
 * dikonfirmasi ulang 24 Agu 2026): jaring pengaman DETERMINISTIK M129
 * (terminologi sertifikat), M130 (jarak), M132 (gerbang terminologi di qual
 * gate) TETAP AKTIF. Itu bukan "backend memutuskan gaya balasan" — itu
 * mencegah LLM MENGARANG fakta legal/numerik, kelas bug M84/M96 yang sudah
 * mahal diperbaiki. Lihat §PERUBAHAN BESAR V10→V11 poin 5(a).
 */

/** Provider yang berarti "tidak ada platform AI" — backend yang memutuskan. */
const LOCAL_PROVIDER = 'private';

/**
 * Profil guardrail yang berlaku untuk giliran ini.
 *
 * @param {string} [agentAiPrimary] users.ai_primary milik agent pemilik nomor
 *   WA. "Default"/kosong → ikut .env AI_PRIMARY_PROVIDER (perilaku lama).
 *   Nilai lain MENGALAHKAN env — tiap agent boleh pakai provider berbeda,
 *   jadi profil guardrail pun ikut per-agent, bukan global.
 * @returns {'local'|'platform'}
 */
function resolveGuardrailProfile(agentAiPrimary = '') {
  const perAgent = String(agentAiPrimary || '').toLowerCase().trim().replace(/\s+/g, '');
  const fromAgent = perAgent && perAgent !== 'default' ? perAgent : '';
  const effective = fromAgent || String(process.env.AI_PRIMARY_PROVIDER || 'chatgpt').toLowerCase().trim();
  return effective === LOCAL_PROVIDER ? 'local' : 'platform';
}

/** Apakah backend boleh MENYUSUN SENDIRI balasan redirect off-topic? */
function backendMayComposeOffTopicRedirect(agentAiPrimary = '') {
  return resolveGuardrailProfile(agentAiPrimary) === 'local';
}

/**
 * Sampah yang JELAS bukan percakapan customer — satu-satunya hal yang boleh
 * ditahan profil 'platform' sebelum memanggil API berbayar.
 *
 * ⚠️ SENGAJA SANGAT SEMPIT. Ini BUKAN tempat menebak "apakah ini soal
 * properti" — penilaian itu tugas platform AI. Pola di bawah hanya menangkap
 * yang secara struktural tidak mungkin butuh jawaban AI.
 */
const OBVIOUS_NOISE_PATTERNS = [
  /^\s*$/,                                            // kosong / hanya spasi
  /^[\s\p{P}\p{S}]+$/u,                               // hanya tanda baca/simbol ("...", "???", "👍")
  /^(ok(e|ay)?|sip|siap|mantap|thanks?|thx|makasih|terima\s*kasih|y|ya|yes|no|ga|gak|nggak)[\s.!]*$/i, // ack telanjang
];

/**
 * Penyaring awal MURAH untuk profil 'platform'.
 *
 * @param {string} message pesan customer mentah
 * @returns {{ forward: boolean, reason: string }}
 *   forward=true  → teruskan ke platform AI, biarkan IA yang memutuskan
 *   forward=false → jangan panggil API sama sekali (hemat token)
 *
 * ⚠️ Ack telanjang ("ok", "makasih") DITAHAN hanya bila TIDAK ada alur
 * kualifikasi aktif — pemanggil yang tahu konteksnya (lihat parameter
 * `inActiveFlow`), karena "ya" di tengah Q1-Q12 adalah JAWABAN yang sah
 * (aturan "an answer to YOUR question is never off-topic", SKILL.md §2 no.10).
 */
function screenForPlatform(message, { inActiveFlow = false } = {}) {
  const text = String(message || '');

  if (!text.trim()) return { forward: false, reason: 'pesan kosong' };

  // Di tengah alur aktif, JANGAN saring apa pun selain benar-benar kosong —
  // jawaban pendek customer ("ya", "2 bulan", "SHM") wajib sampai ke AI.
  if (inActiveFlow) return { forward: true, reason: 'alur kualifikasi aktif — semua jawaban diteruskan' };

  for (const re of OBVIOUS_NOISE_PATTERNS) {
    if (re.test(text)) return { forward: false, reason: 'ack/noise telanjang di luar alur aktif' };
  }

  // Ragu → TERUSKAN. Fail-open adalah default yang disengaja di profil ini.
  return { forward: true, reason: 'lolos penyaring awal — keputusan diserahkan ke platform AI' };
}

module.exports = {
  LOCAL_PROVIDER,
  resolveGuardrailProfile,
  backendMayComposeOffTopicRedirect,
  screenForPlatform,
  OBVIOUS_NOISE_PATTERNS,
};
