'use strict';
/**
 * contextSwitchPolicy.js — SATU sumber kebenaran untuk pertanyaan
 *   "customer mengganti kota / transaksi / tipe properti di tengah alur:
 *    informasi apa yang HARUS TETAP DIINGAT AI, dan apa yang harus DILUPAKAN?"
 *
 * ══════════════════════════════════════════════════════════════════════════
 * KENAPA MODUL INI ADA (M154, 28 Agu 2026)
 * ══════════════════════════════════════════════════════════════════════════
 * Aturan ini sebelumnya DITULIS DUA KALI, di dua ekstraktor yang berbeda, dan
 * kedua salinan itu SUDAH SALING BERTENTANGAN di produksi:
 *
 *   1. services/aiPromptBuilderService.js → extractQualificationState()
 *      Dipakai untuk: blok state ✅/❓ di prompt, summary, findNextQuestion().
 *      Sudah diperbaiki granular di M124 (per-axis) dan M132 (compound reset).
 *
 *   2. services/propertyRecommendationService.js → extractPropertyFilters()
 *      Dipakai untuk: pencarian katalog (filterProperties) DAN
 *      utils/listingReadiness.evaluateListingReadiness() — yaitu blok
 *      "SYARAT MINIMUM LISTING" yang ikut masuk ke prompt LLM.
 *      TIDAK PERNAH ikut diperbaiki M124/M132. Ia masih memakai perilaku
 *      RESET TOTAL pra-M124: begitu tipe properti berubah, ia menghapus
 *      transactionType, location, budget, facilities DAN landmark sekaligus.
 *
 * Akibat nyata dari perbedaan itu (inilah "AI lose & forget konteks"):
 *   • Customer: "eh, apartemen aja" (setelah kota=Surabaya, area=Pakuwon).
 *   • Ekstraktor #1 (benar, sesuai spec): kota & landmark DIPERTAHANKAN
 *     → prompt berisi "✅ Kota [Q2]: Surabaya", "✅ Patokan lokasi [Q6]: Pakuwon".
 *   • Ekstraktor #2 (salah): location='' dan landmark='' → readiness melaporkan
 *     "SYARAT MINIMUM LISTING: BELUM TERPENUHI. Masih kurang: kota,
 *      area/kawasan atau patokan lokasi."
 *   • Kedua blok itu masuk ke SATU prompt yang sama. LLM menerima dua fakta
 *     yang berlawanan tentang hal yang sama, dan memilih yang berbentuk
 *     perintah ("Tanyakan yang kurang, SATU per pesan") → AI menanyakan ULANG
 *     kota dan area yang BARU SAJA dijawab customer. Persis pola berulang /
 *     looping / redundant yang dilarang pemilik proyek.
 *   • Di saat yang sama pencarian katalog kehilangan kota, jadi listing yang
 *     ditarik bisa lintas-kota (bertentangan dengan aturan cakupan kota).
 *
 * ⛔ MODUL INI TIDAK MEMUTUSKAN BALASAN dan tidak memanggil LLM. Ia hanya
 *    menerjemahkan "axis mana yang berubah" menjadi "field mana yang dibuang"
 *    plus teks banner. Semua pemanggil WAJIB memakai tabel di sini; jangan
 *    menyalin daftar field-nya ke tempat lain (pelajaran ngekos-detection:
 *    regex yang diduplikasi ke 5 tempat harus diperbaiki 5 kali).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * SPEC PEMILIK PROYEK (28 Agu 2026) — disalin apa adanya sebagai kontrak
 * ══════════════════════════════════════════════════════════════════════════
 * GANTI KOTA
 *   1. Tanyakan ulang lokasi landmark saja; customer bebas meng-update area
 *      dan landmark dari chat sebelumnya.
 *   2. Transaksi masih sama.      3. Tanggal pindah masih sama.
 *   4. Survei masih dengan nilai sama (jadwal survei / minta katalog).
 *   5. Fasilitas sama.
 *
 * GANTI TRANSAKSI
 *   1. Tanyakan budget yang lebih sesuai dengan tipe transaksi atas tipe
 *      properti.                  2. Tanyakan metode pembayaran (cash/KPR/dst).
 *   3. Kota masih sama.           4. Landmark masih sama.
 *   5. Tanggal pindah masih sama. 6. Survei masih dengan nilai sama.
 *   7. Fasilitas mengikuti skill tipe transaksi atas tipe properti
 *      (DIPERHATIKAN — bukan dihapus; lihat catatan FACILITIES di bawah).
 *   8. Jika sewa, tanyakan durasi sewa/booking.
 *
 * GANTI PROPERTI
 *   1. Tanyakan sesuai konteks tipe properti yang baru.
 *   2. Kota dibuat sama.          3. Transaksi dibuat sama.
 *   4. Landmark masih sama.       5. Tanggal pindah masih sama.
 *   6. Survei masih dengan nilai sama.
 *   7. Fasilitas mengikuti skill tipe transaksi atas tipe properti.
 *
 * TUJUAN AKHIR: AI hanya perlu MENGEJAR 4 informasi — tipe properti, tipe
 * transaksi, kota, dan lokasi spesifik (area/landmark). Kalau customer sudah
 * menyebut keempatnya, AI DILARANG bertanya lagi.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * CATATAN FACILITIES — kenapa "diperhatikan" ≠ "dihapus"
 * ══════════════════════════════════════════════════════════════════════════
 * Spec ganti-transaksi item 7 dan ganti-properti item 7 memakai kata
 * "diperhatikan", bukan "tanyakan ulang". Menghapus fasilitas pada GANTI
 * TRANSAKSI akan memaksa satu pertanyaan ulang — justru yang dilarang. Jadi:
 *   • GANTI TRANSAKSI → fasilitas DIPERTAHANKAN, tapi banner memerintahkan AI
 *     memvalidasinya ulang terhadap skill tipe-transaksi × tipe-properti yang
 *     baru (mis. "full furnished" relevan untuk sewa, hampir tak berarti untuk
 *     beli tanah).
 *   • GANTI PROPERTI → fasilitas DIBUANG. Daftar fasilitas terikat erat pada
 *     tipe (gym/lobby untuk apartemen vs carport/taman untuk rumah), jadi
 *     mempertahankannya bukan "mengingat", melainkan mencemari pencarian baru.
 */

/**
 * Tabel spec deklaratif. Sengaja DATA, bukan kode bercabang, supaya tes,
 * dokumen skill, dan banner prompt semuanya membaca sumber yang sama.
 *
 * `forgetFilters`  : field pada extractPropertyFilters() yang dikosongkan.
 * `keepFilters`    : field yang WAJIB bertahan (dites eksplisit — inilah yang
 *                    dulu ikut terhapus dan menyebabkan pertanyaan berulang).
 * `reask`          : slot yang boleh/harus ditanyakan ulang oleh AI.
 * `neverReask`     : slot yang HARAM ditanyakan ulang pada axis ini.
 */
const CONTEXT_SWITCH_SPEC = {
  city: {
    label        : 'GANTI KOTA',
    forgetFilters: ['landmark'],
    keepFilters  : ['buildingType', 'transactionType', 'budget', 'facilities'],
    reask        : ['landmark'],
    neverReask   : ['transactionType', 'buildingType', 'moveInDate', 'viewingDate',
                    'viewingTime', 'decisionMaker', 'facilities', 'budget'],
  },
  transaction: {
    label        : 'GANTI TRANSAKSI',
    forgetFilters: ['budget'],
    keepFilters  : ['buildingType', 'location', 'landmark', 'facilities'],
    reask        : ['budget', 'financing', 'leaseDuration'],
    neverReask   : ['city', 'landmark', 'buildingType', 'moveInDate', 'viewingDate',
                    'viewingTime', 'decisionMaker'],
  },
  type: {
    label        : 'GANTI PROPERTI',
    forgetFilters: ['budget', 'facilities', 'fallbackTypes'],
    keepFilters  : ['transactionType', 'location', 'landmark'],
    reask        : ['budget', 'facilities'],
    neverReask   : ['city', 'landmark', 'transactionType', 'moveInDate', 'viewingDate',
                    'viewingTime', 'decisionMaker', 'leaseDuration', 'redFlags'],
  },
  /**
   * Compound = tipe DAN transaksi berubah di pesan yang SAMA (M132). Dipandang
   * sebagai pencarian yang genuinely baru, jadi resetnya lebih luas daripada
   * gabungan dua axis di atas — TAPI landmark hanya ikut dibuang bila kota juga
   * berubah di pesan yang sama.
   */
  compound: {
    label        : 'GANTI TIPE + TRANSAKSI SEKALIGUS',
    forgetFilters: ['budget', 'facilities', 'fallbackTypes'],
    forgetIfCity : ['landmark'],
    keepFilters  : ['location'],
    reask        : ['budget', 'financing', 'facilities', 'leaseDuration'],
    neverReask   : ['moveInDate', 'viewingDate', 'viewingTime', 'decisionMaker'],
  },
};

/** Nilai "kosong" per field filter — bentuknya beda-beda, jangan disamakan. */
const _EMPTY_FILTER_VALUE = {
  buildingType   : '',
  transactionType: '',
  location       : '',
  landmark       : '',
  budget         : null,
  facilities     : [],
  fallbackTypes  : [],
};

/**
 * Terapkan kebijakan lupa/ingat pada akumulator filter.
 *
 * ⚠️ Dipanggil SEBELUM nilai baru dari pesan yang memicu perubahan ditulis ke
 * akumulator. Urutannya penting: "buang yang basi" dulu, "tulis yang baru"
 * kemudian — kalau dibalik, nilai baru yang sah ikut terhapus.
 *
 * @param {object} acc  akumulator filter (dimutasi di tempat DAN dikembalikan)
 * @param {{typeChanged?:boolean, txChanged?:boolean, cityChanged?:boolean}} changed
 * @returns {object} acc
 */
function applyFilterSwitchPolicy(acc, changed = {}) {
  if (!acc) return acc;
  const typeChanged = !!changed.typeChanged;
  const txChanged   = !!changed.txChanged;
  const cityChanged = !!changed.cityChanged;
  if (!typeChanged && !txChanged && !cityChanged) return acc;

  const clear = (field) => {
    if (!Object.prototype.hasOwnProperty.call(_EMPTY_FILTER_VALUE, field)) return;
    const empty = _EMPTY_FILTER_VALUE[field];
    acc[field] = Array.isArray(empty) ? [] : empty;
  };

  if (typeChanged && txChanged) {
    // Compound (M132) — menggantikan, BUKAN menambah, kedua axis tunggalnya.
    CONTEXT_SWITCH_SPEC.compound.forgetFilters.forEach(clear);
    if (cityChanged) CONTEXT_SWITCH_SPEC.compound.forgetIfCity.forEach(clear);
    return acc;
  }

  // Axis tunggal — boleh menumpuk bila dua axis non-compound berubah bersamaan
  // (mis. tipe + kota tanpa transaksi). Tiap blok hanya menyentuh field-nya
  // sendiri, jadi tidak ada reset yang saling bertentangan.
  if (typeChanged) CONTEXT_SWITCH_SPEC.type.forgetFilters.forEach(clear);
  if (txChanged)   CONTEXT_SWITCH_SPEC.transaction.forgetFilters.forEach(clear);
  if (cityChanged) CONTEXT_SWITCH_SPEC.city.forgetFilters.forEach(clear);
  return acc;
}

/**
 * Apakah dua nama lokasi merujuk kota yang BERBEDA (bukan penghalusan)?
 *
 * "Jakarta" → "Jakarta Selatan" BUKAN ganti kota, itu perincian; membuangnya
 * sebagai "ganti kota" akan menghapus landmark yang justru baru saja diberikan.
 * Guard substring dua arah sama dengan yang dipakai resolver kanonik Phase 0 di
 * aiPromptBuilderService.js — sengaja identik supaya dua ekstraktor tidak
 * berbeda pendapat tentang apa yang disebut "ganti kota".
 *
 * @param {string} prev
 * @param {string} next
 * @returns {boolean}
 */
function isGenuineCityChange(prev, next) {
  if (!prev || !next) return false;
  const p = String(prev).toLowerCase().trim();
  const n = String(next).toLowerCase().trim();
  if (!p || !n || p === n) return false;
  if (p.includes(n) || n.includes(p)) return false;   // refinement, bukan ganti
  return true;
}

/**
 * Bangun banner peringatan untuk prompt LLM.
 *
 * ⚠️ Banner ini WAJIB menyebut secara eksplisit apa yang TETAP DIPAKAI, bukan
 * hanya apa yang berubah. Versi lama hanya punya banner KOTA dan TIPE; GANTI
 * TRANSAKSI tidak punya banner sama sekali, sehingga LLM melihat budget tiba-tiba
 * kembali ❓ tanpa penjelasan dan menyimpulkan sendiri bahwa alur mengulang dari
 * awal — lalu menanyakan ulang kota/landmark/tanggal yang masih ✅.
 *
 * @param {object} flags { cityChanged, txChanged, typeChanged, transactionType, buildingType }
 * @returns {string[]} baris-baris prompt ([] bila tidak ada perubahan)
 */
function buildSwitchBanners(flags = {}) {
  const { cityChanged, txChanged, typeChanged } = flags;
  const lines = [];
  if (!cityChanged && !txChanged && !typeChanged) return lines;

  const tx     = String(flags.transactionType || '').toLowerCase();
  const isSewa = tx.includes('rent') || tx.includes('sewa');

  if (typeChanged && txChanged) {
    lines.push('⚠️  TIPE PROPERTI **DAN** TRANSAKSI BERUBAH BERSAMAAN — pencarian baru.');
    lines.push('   ⛔ JANGAN menanyakan ulang tipe properti atau sewa/beli: customer BARU SAJA');
    lines.push('      menyebut keduanya di pesan ini. Menanyakannya lagi = pengulangan.');
    lines.push('   ✅ TETAP DIPAKAI (jangan tanya ulang): tanggal masuk, jadwal & pendamping survei,');
    lines.push('      durasi sewa.' + (cityChanged ? '' : ' Kota, area, landmark, dan red flag juga TETAP.'));
    lines.push('   ❓ Perlu digali ulang: budget (rentang baru), metode pembayaran, fasilitas.');
    if (cityChanged) lines.push('   📍 Kota juga berubah → tanyakan patokan lokasi/landmark di kota BARU.');
    lines.push('');
    return lines;
  }

  if (typeChanged) {
    lines.push('⚠️  TIPE PROPERTI BERUBAH — customer beralih ke jenis properti lain.');
    lines.push('   ✅ TETAP DIPAKAI (⛔ JANGAN tanya ulang): kota, area/kawasan, patokan lokasi/landmark,');
    lines.push('      tipe transaksi (sewa/beli), durasi sewa, red flag & preferensi lokasi,');
    lines.push('      tanggal masuk, jadwal survei, dan pendamping survei.');
    lines.push('   ❓ Perlu digali ulang: budget (rentang tipe baru) dan fasilitas khas tipe baru.');
    lines.push('   Akui perubahan singkat (1 kalimat), lalu lanjut dari pertanyaan ❓ terkecil.');
    lines.push('');
  }

  if (txChanged) {
    lines.push('⚠️  TIPE TRANSAKSI BERUBAH — customer beralih ' +
      (isSewa ? 'dari BELI ke SEWA.' : 'dari SEWA ke BELI.'));
    lines.push('   ✅ TETAP DIPAKAI (⛔ JANGAN tanya ulang): kota, area/kawasan, patokan lokasi/landmark,');
    lines.push('      tipe properti, tanggal masuk, jadwal survei, dan pendamping survei.');
    lines.push('   ❓ Perlu digali ulang: budget dengan rentang yang sesuai transaksi BARU atas tipe');
    lines.push('      properti ini, lalu metode pembayaran' +
      (isSewa ? ' (cash / transfer / termin).' : ' (cash / KPR / kombinasi).'));
    if (isSewa) lines.push('   ⏳ Karena sekarang SEWA: tanyakan juga durasi sewa/booking.');
    lines.push('   🏊 Fasilitas yang sudah disebut TETAP DICATAT — jangan tanya ulang; cukup');
    lines.push('      sesuaikan relevansinya dengan skill transaksi baru atas tipe properti ini.');
    lines.push('');
  }

  if (cityChanged) {
    lines.push('⚠️  KOTA BERUBAH — customer memindahkan pencarian ke kota lain.');
    lines.push('   ✅ TETAP DIPAKAI (⛔ JANGAN tanya ulang): tipe transaksi, tipe properti, budget,');
    lines.push('      fasilitas, tanggal masuk, jadwal survei, dan pendamping survei.');
    lines.push('   ❓ Yang ditanyakan HANYA patokan lokasi/landmark di kota BARU (Q6).');
    lines.push('      Customer bebas menyebut area/kawasan baru sendiri — terima, jangan paksa.');
    lines.push('   ⛔ JANGAN menawarkan pindah kota lagi dan JANGAN memakai landmark kota LAMA.');
    lines.push('');
  }

  return lines;
}

module.exports = {
  CONTEXT_SWITCH_SPEC,
  applyFilterSwitchPolicy,
  isGenuineCityChange,
  buildSwitchBanners,
};
