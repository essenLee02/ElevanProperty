'use strict';
/**
 * leadScoringService.js — PENILAI KESERIUSAN CUSTOMER (M138)
 *
 * Directive pemilik proyek (24 Agu 2026): tentukan customer mana yang LAYAK
 * di-follow-up agent, dari 7 indikator yang diamati sepanjang percakapan.
 * Admin (users.privilege='Admin') memakai hasilnya untuk menyerahkan nama +
 * nomor WhatsApp + summary ke agent.
 *
 * ⛔ MODUL INI TIDAK PERNAH MENYUSUN BALASAN KE CUSTOMER.
 * Ia HANYA membaca transkrip dan menghasilkan angka + alasan, untuk dilihat
 * ADMIN. Ini penting: sejak M131/M133 keputusan balas/diam ada di platform AI
 * saat AI_PRIMARY_PROVIDER != 'private'. Scoring adalah alat INTERNAL
 * (business intelligence), bukan jalur percakapan — jadi ia boleh sepenuhnya
 * deterministik tanpa melanggar pembagian wewenang itu.
 *
 * ── 7 INDIKATOR (bobot berbeda — sengaja TIDAK rata) ──────────────────────
 * Bobot mencerminkan seberapa kuat sebuah sinyal memprediksi transaksi nyata,
 * bukan seberapa sering ia muncul:
 *
 *   1. INTENT       (25) beli/sewa eksplisit          — tanpa ini tidak ada lead
 *   2. SURVEY       (25) mau survei/lihat unit         — sinyal TERKUAT: minta waktu nyata
 *   3. KPR          (15) tanya pembiayaan/KPR          — sedang memikirkan cara BAYAR
 *   4. UPFRONT_COST (15) biaya awal/notaris/AJB/BPHTB  — sedang memikirkan BIAYA TOTAL
 *   5. SPECS        (10) kamar tidur/mandi/luas        — mengevaluasi unit spesifik
 *   6. DEVELOPER    (5)  tanya agensi/developer        — due diligence, tapi murah diucapkan
 *   7. PROMO        (5)  tanya promo/diskon            — bisa sekadar pemburu diskon
 *
 * Total maksimum 100. Ambang (bisa di-override .env):
 *   >= 60 → 'serius'        — WAJIB di-follow-up
 *   >= 30 → 'potensial'     — layak dilirik
 *   <  30 → 'belum serius'  — biarkan AI lanjut kualifikasi
 *
 * ⚠️ KENAPA SURVEY & INTENT SAMA-SAMA 25: keduanya saja (50) belum cukup
 * mencapai ambang 'serius'. Ini DISENGAJA — customer yang bilang "mau beli"
 * lalu "mau survei" tetap harus menunjukkan SATU sinyal komitmen lain (KPR,
 * biaya, atau spesifikasi) sebelum dilabeli serius. Mencegah label 'serius'
 * jadi murah, yang akan membuat agent berhenti mempercayainya.
 */

const num = (envKey, fallback) => {
  const n = Number(process.env[envKey]);
  return Number.isFinite(n) ? n : fallback;
};

const THRESHOLD_SERIOUS   = num('LEAD_SCORE_SERIOUS_MIN', 60);
const THRESHOLD_POTENTIAL = num('LEAD_SCORE_POTENTIAL_MIN', 30);

/**
 * Definisi indikator. `re` diuji terhadap gabungan pesan CUSTOMER saja
 * (pesan AI TIDAK dihitung — kalau tidak, pertanyaan AI sendiri "mau survei?"
 * akan menaikkan skor customer yang belum menjawab apa pun).
 */
const INDICATORS = [
  {
    key: 'intent',
    weight: 25,
    label: 'Niat beli/sewa',
    re: /\b(mau|ingin|pengen|pengin|cari|nyari|berminat|minat|tertarik|butuh)\b[^.!?]{0,40}\b(beli|membeli|sewa|menyewa|ngontrak|kontrak|ngekos|kos|rumah|apartemen|apartement|ruko|villa|gudang|kantor|tanah)\b|\b(beli|sewa)\s+(rumah|apartemen|apartement|ruko|villa|gudang|kantor|tanah|unit)\b/i,
  },
  {
    key: 'survey',
    weight: 25,
    label: 'Mau survei / lihat unit',
    re: /\b(survei|survey|surve|lihat\s+(unit|rumah|lokasi|tempat|propertinya)|kunjungan|visit|viewing|datang\s+ke\s+lokasi|cek\s+lokasi|liat\s+langsung|lihat\s+langsung)\b/i,
  },
  {
    key: 'kpr',
    weight: 15,
    label: 'Tanya KPR / pembiayaan',
    re: /\bkpr\b|\bcicilan\b|\bangsuran\b|\bkredit\b|\bdp\b|\buang\s+muka\b|\bflpp\b|\bsubsidi\b|\bbunga\b|\btenor\b|\bbank\b/i,
  },
  {
    key: 'upfront_cost',
    weight: 15,
    label: 'Tanya biaya awal / notaris / AJB',
    re: /\bbiaya\s+(awal|notaris|balik\s+nama|administrasi|admin|tambahan|lain)\b|\bnotaris\b|\bppat\b|\bajb\b|\bbphtb\b|\bpajak\b|\bbea\b|\bbiaya\s+apa\s+saja\b/i,
  },
  {
    key: 'specs',
    weight: 10,
    label: 'Tanya spesifikasi unit',
    re: /\b(berapa|brp|ada\s+berapa|jumlah)\b[^.!?]{0,30}\b(kamar|kmr|kt|km|toilet|wc|lantai|luas)\b|\bkamar\s+(tidur|mandi)\b|\b\d+\s*(kt|km|kamar)\b|\bluas\s+(tanah|bangunan)\b|\bberapa\s+(m2|meter)\b/i,
  },
  {
    key: 'developer',
    weight: 5,
    label: 'Tanya developer / agensi',
    re: /\bdevelopernya?\b|\bpengembangnya?\b|\bagen(?:si|nya|t)?\b|\bbrokernya?\b|\bray\s*white\b|\bera\s+property\b|\bxavier\s+marks\b|\bgalaxy\s+property\b|\bbrighton\b|\bpropnex\b|\bdari\s+(perusahaan|kantor)\s+mana\b/i,
  },
  {
    key: 'promo',
    weight: 5,
    label: 'Tanya promo / diskon',
    re: /\bpromo\b|\bdiskon\b|\bpotongan\s+harga\b|\bcashback\b|\bhadiah\b|\bbonus\b|\bfree\b|\bgratis\b|\bsubsidi\s+dp\b/i,
  },
];

/** Total bobot semua indikator — dihitung, bukan di-hardcode 100. */
const MAX_SCORE = INDICATORS.reduce((sum, i) => sum + i.weight, 0);

/**
 * Gabungkan HANYA pesan customer dari history + pesan terbaru.
 *
 * ⚠️ Peran 'user' (chatbot web) dan 'customer' (WhatsApp) KEDUANYA dipakai di
 * proyek ini — memfilter salah satunya saja adalah bug senyap yang membuat
 * skor selalu 0 di salah satu kanal.
 */
function collectCustomerText(history = [], currentMessage = '') {
  const parts = (history || [])
    .filter(m => m && (m.role === 'user' || m.role === 'customer'))
    .map(m => String(m.message || ''));
  if (currentMessage) parts.push(String(currentMessage));
  return parts.join('\n');
}

/**
 * Hitung skor keseriusan customer.
 *
 * @param {object} params
 * @param {Array}  params.history        transkrip [{role, message}]
 * @param {string} [params.currentMessage] pesan terbaru (belum masuk history)
 * @returns {{
 *   score:number, maxScore:number, percent:number, tier:string,
 *   isSerious:boolean, matched:object[], missing:object[], reason:string
 * }}
 */
function scoreLead({ history = [], currentMessage = '' } = {}) {
  const text = collectCustomerText(history, currentMessage);

  const matched = [];
  const missing = [];

  for (const ind of INDICATORS) {
    if (text && ind.re.test(text)) {
      matched.push({ key: ind.key, label: ind.label, weight: ind.weight });
    } else {
      missing.push({ key: ind.key, label: ind.label, weight: ind.weight });
    }
  }

  const score   = matched.reduce((sum, m) => sum + m.weight, 0);
  const percent = MAX_SCORE > 0 ? Math.round((score / MAX_SCORE) * 100) : 0;

  const tier = score >= THRESHOLD_SERIOUS ? 'serius'
    : score >= THRESHOLD_POTENTIAL ? 'potensial'
      : 'belum serius';

  const reason = matched.length
    ? `${matched.length}/${INDICATORS.length} indikator terpenuhi: ${matched.map(m => m.label).join(', ')}.`
    : 'Belum ada indikator keseriusan yang terdeteksi dari pesan customer.';

  return {
    score,
    maxScore: MAX_SCORE,
    percent,
    tier,
    isSerious: tier === 'serius',
    matched,
    missing,
    reason,
  };
}

/**
 * Apakah customer ini LAYAK diserahkan ke agent untuk follow-up?
 * Ambang sengaja 'serius' saja — 'potensial' masih boleh dikualifikasi AI dulu.
 */
function isFollowUpWorthy(result) {
  return Boolean(result && result.tier === 'serius');
}

module.exports = {
  INDICATORS,
  MAX_SCORE,
  THRESHOLD_SERIOUS,
  THRESHOLD_POTENTIAL,
  collectCustomerText,
  scoreLead,
  isFollowUpWorthy,
};
