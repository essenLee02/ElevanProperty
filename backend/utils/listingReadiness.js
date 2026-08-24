'use strict';
/**
 * listingReadiness.js — SYARAT MINIMUM sebelum listing boleh ditampilkan (M134)
 *
 * Directive pemilik proyek (24 Agu 2026):
 *   "Jika AI bisa dapat tipe property, tipe transaksi, kota dan lokasi tertentu
 *    (area, landmark, komersial); maka AI bisa berikan listing kepada customers."
 *
 * ⚠️ PERUBAHAN PENTING DARI ATURAN LAMA: slot ke-4 sekarang **LOKASI SPESIFIK**
 * (area/landmark/commercial), BUKAN budget. Sebelumnya `buildQualifyReply()`
 * mensyaratkan type+tx+kota+BUDGET sebelum lolos ke katalog. Sekarang budget
 * TIDAK lagi jadi syarat menampilkan listing — customer boleh melihat pilihan
 * dulu, lalu menyesuaikan harga setelah melihat ("kok kemahalan ya, saya mau
 * yang 1-2,5 juta"), yang memang alur percakapan nyata di transkrip.
 *
 * ⛔ MODUL INI TIDAK MEMUTUSKAN BALASAN. Ia hanya menjawab satu pertanyaan
 * faktual — "apakah 4 slot minimum sudah terisi, dan kalau belum, mana yang
 * kurang?" — lalu hasilnya:
 *   • profil 'platform' → dirender jadi FAKTA di prompt; platform AI yang
 *     memutuskan mau menanyakan apa dan dengan kalimat apa.
 *   • profil 'local'    → dipakai Private Agent sebagai gerbang deterministik.
 * Lihat utils/guardrailPolicy.js untuk pembagian wewenang ini.
 */

/** Slot minimum, berurutan sesuai prioritas bertanya bila kosong. */
const REQUIRED_SLOTS = ['buildingType', 'transactionType', 'city', 'specificLocation'];

const SLOT_LABEL_ID = {
  buildingType    : 'tipe properti',
  transactionType : 'sewa atau beli',
  city            : 'kota',
  specificLocation: 'area/kawasan atau patokan lokasi',
};

/**
 * Apakah filters sudah memenuhi syarat minimum untuk menampilkan listing?
 *
 * @param {object} filters hasil extractPropertyFilters() — { buildingType,
 *   transactionType, location, district, landmark, area }
 * @returns {{ ready: boolean, missing: string[], missingLabels: string[], have: object }}
 */
function evaluateListingReadiness(filters = {}) {
  // `location` di extractPropertyFilters() = KOTA. Lokasi spesifik bisa datang
  // dari beberapa slot berbeda tergantung apa yang disebut customer:
  //   district  → nama kawasan/kecamatan ("Kebomas", "Klojen")
  //   area      → kawasan pada listing ("Pakuwon Indah")
  //   landmark  → patokan ("dekat PTC", "dekat Bandara Juanda")
  // Ketiganya sama-sama SAH sebagai "lokasi tertentu" per directive — commercial
  // (Alfamart/Indomaret/RS) masuk lewat landmark, karena Location.location_type
  // 'commercial' juga terdeteksi oleh detectLandmark().
  const have = {
    buildingType    : String(filters.buildingType    || '').trim(),
    transactionType : String(filters.transactionType || '').trim(),
    city            : String(filters.location        || '').trim(),
    specificLocation: String(filters.district || filters.area || filters.landmark || '').trim(),
  };

  const missing = REQUIRED_SLOTS.filter((slot) => !have[slot]);

  return {
    ready: missing.length === 0,
    missing,
    missingLabels: missing.map((s) => SLOT_LABEL_ID[s] || s),
    have,
  };
}

/**
 * Render readiness jadi blok FAKTA untuk prompt LLM.
 *
 * ⛔ Sengaja DESKRIPTIF, bukan imperatif — menyatakan keadaan, bukan menyuruh
 * kalimat tertentu. Platform AI yang memutuskan mau bertanya apa & bagaimana
 * (directive M131/M133). Pola sama dengan blok KATALOG NYATA AGENT INI.
 *
 * @param {object} readiness hasil evaluateListingReadiness()
 * @returns {string} '' bila tidak ada yang perlu disampaikan (nol token)
 */
function buildListingReadinessContext(readiness) {
  if (!readiness) return '';

  if (readiness.ready) {
    return [
      'SYARAT MINIMUM LISTING: TERPENUHI.',
      `- Diketahui: tipe=${readiness.have.buildingType}, transaksi=${readiness.have.transactionType}, ` +
      `kota=${readiness.have.city}, lokasi spesifik=${readiness.have.specificLocation}.`,
      '- Listing SUDAH BOLEH ditampilkan tanpa menunggu budget. Budget bukan syarat; ' +
      'customer lazim menyesuaikan harga SETELAH melihat pilihan.',
    ].join('\n');
  }

  return [
    'SYARAT MINIMUM LISTING: BELUM TERPENUHI.',
    `- Sudah ada: ${REQUIRED_SLOTS.filter((s) => readiness.have[s]).map((s) => `${SLOT_LABEL_ID[s]}=${readiness.have[s]}`).join(', ') || '(belum ada)'}.`,
    `- Masih kurang: ${readiness.missingLabels.join(', ')}.`,
    '- Sebelum lengkap: JANGAN tampilkan listing/harga/nama properti. Tanyakan yang kurang, SATU per pesan.',
  ].join('\n');
}

module.exports = {
  REQUIRED_SLOTS,
  SLOT_LABEL_ID,
  evaluateListingReadiness,
  buildListingReadinessContext,
};
