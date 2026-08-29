/**
 * contextSwitchPolicyM154.test.js — regresi M154.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BUG YANG DIKUNCI TES INI: DUA EKSTRAKTOR, DUA KEBIJAKAN, SATU PROMPT
 * ══════════════════════════════════════════════════════════════════════════
 * Aturan "customer ganti kota/transaksi/tipe → ingat apa, lupakan apa" ditulis
 * di DUA tempat yang tidak pernah disinkronkan:
 *
 *   A. aiPromptBuilderService.extractQualificationState()
 *      → blok state ✅/❓, summary, findNextQuestion().
 *      → SUDAH granular sejak M124/M132.
 *
 *   B. propertyRecommendationService.extractPropertyFilters()
 *      → pencarian katalog DAN utils/listingReadiness.evaluateListingReadiness(),
 *        yang hasilnya ikut dirender ke prompt sebagai blok
 *        "SYARAT MINIMUM LISTING".
 *      → masih memakai RESET TOTAL pra-M124.
 *
 * Begitu customer mengganti TIPE PROPERTI, (B) menghapus transactionType,
 * location, budget, facilities dan landmark sekaligus. Prompt yang sama lalu
 * memuat dua fakta yang berlawanan:
 *
 *     ✅ Kota [Q2]: Surabaya                     ← dari (A)
 *     SYARAT MINIMUM LISTING: BELUM TERPENUHI.
 *     - Masih kurang: sewa atau beli, kota, ...  ← dari (B)
 *     - Tanyakan yang kurang, SATU per pesan.
 *
 * LLM menuruti kalimat yang berbentuk PERINTAH → menanyakan ULANG sewa/beli,
 * kota, dan area yang baru saja dijawab customer. Itulah mekanisme persis dari
 * keluhan "AI lose & forget konteks / bertanya berulang" saat ganti tipe.
 *
 * Spec pemilik proyek (28 Agu 2026) yang dilanggar (B):
 *   GANTI PROPERTI  item 2 "Kota dibuat sama", item 3 "transaksi dibuat sama",
 *                   item 4 "landmark masih sama".
 *   GANTI TRANSAKSI item 1 "tanyakan budget yang lebih sesuai" — (B) justru
 *                   MEMPERTAHANKAN budget sewa lama ke pencarian beli.
 *   GANTI KOTA      item 1 "tanyakan ulang lokasi landmark" — (B) tidak pernah
 *                   membuang landmark saat kota berubah, sehingga patokan kota
 *                   LAMA ikut menyaring katalog kota BARU.
 *
 * Plus dua pelanggaran monotonisitas di (A) sendiri: cabang typeChangedNow
 * membuang `redFlags` dan `leaseDuration`, padahal cabang compoundReset yang
 * JAUH LEBIH LUAS justru mempertahankan keduanya.
 *
 * Run: node tests/contextSwitchPolicyM154.test.js
 */

'use strict';

require('dotenv').config();

const Module = require('module');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== '' ? ' — got: ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

/**
 * Muat propertyRecommendationService dengan master data PALSU (kota + lokasi),
 * lalu hangatkan kedua cache. detectLandmark() mengembalikan '' selama
 * _landmarkCache kosong, jadi tanpa seed ini seluruh asersi landmark akan
 * "lulus" karena nilainya memang selalu kosong — lulus untuk alasan yang salah.
 */
async function loadService() {
  const svcPath = require.resolve('../services/propertyRecommendationService');
  delete require.cache[svcPath];

  const CITIES = [{ city_id: 1, name: 'SURABAYA' }, { city_id: 2, name: 'MALANG' }];
  const LOCATIONS = [
    { location_id: 11, name: 'PAKUWON INDAH', city_id: 1, location_type: 'area',     status: 1 },
    { location_id: 12, name: 'TUNJUNGAN PLAZA (TP)', city_id: 1, location_type: 'landmark', status: 1 },
    { location_id: 21, name: 'KLOJEN', city_id: 2, location_type: 'area', status: 1 },
  ];

  const origLoad = Module._load;
  Module._load = function (req, parent) {
    if (req === '../models' && parent && parent.filename === svcPath) {
      return {
        City:     { findAll: async () => CITIES },
        Location: { findAll: async () => LOCATIONS },
      };
    }
    return origLoad.apply(this, arguments);
  };
  try {
    const svc = require(svcPath);
    await svc.initCityCache();
    await svc.initLandmarkCache();
    return svc;
  } finally {
    Module._load = origLoad;
  }
}

(async () => {
  const svc = await loadService();
  const { extractPropertyFilters } = svc;
  const { extractQualificationState } = require('../services/aiPromptBuilderService');
  const { evaluateListingReadiness } = require('../utils/listingReadiness');
  const { buildSwitchBanners, applyFilterSwitchPolicy, isGenuineCityChange,
          CONTEXT_SWITCH_SPEC } = require('../utils/contextSwitchPolicy');

  // Pastikan seed benar-benar hidup — kalau tidak, asersi landmark di bawah
  // tidak membuktikan apa pun (pelajaran: tes yang lulus karena nilainya selalu
  // kosong adalah tes yang bohong).
  console.log('── Group 0: prasyarat seed master data ──');
  ok('detectLandmark mengenali "Tunjungan Plaza" (cache landmark ter-seed)',
     /tunjungan/i.test(svc.detectLandmark('cari yang dekat Tunjungan Plaza') || ''),
     svc.detectLandmark('cari yang dekat Tunjungan Plaza'));
  ok('detectLocation mengenali Surabaya & Malang',
     svc.detectLocation('di Surabaya') === 'Surabaya' && svc.detectLocation('ke Malang') === 'Malang');

  /* ───────────────────────────────────────────────────────────────────────
   * GANTI PROPERTI — inti bug. Kota/transaksi/landmark WAJIB bertahan.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 1: GANTI PROPERTI (rumah → apartemen) ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Di area atau kawasan mana? 📍'),
      C('dekat Tunjungan Plaza'),
      A('Kisaran budget berapa?'),
      C('sekitar 5 juta per bulan'),
      A('Fasilitas apa yang penting?'),
      C('kolam renang dan gym'),
    ];
    const f = extractPropertyFilters('eh, apartemen saja deh', hist);

    // ── Yang WAJIB DIINGAT (dulu semuanya terhapus) ──
    ok('transaksi TETAP rent (spec item 3 "transaksi dibuat sama")',
       f.transactionType === 'rent', f.transactionType);
    ok('kota TETAP Surabaya (spec item 2 "Kota dibuat sama")',
       /surabaya/i.test(f.location || ''), f.location);
    ok('landmark TETAP Tunjungan Plaza (spec item 4 "landmark masih sama")',
       /tunjungan/i.test(f.landmark || ''), f.landmark);

    // ── Yang memang boleh DILUPAKAN (terikat tipe) ──
    ok('tipe ter-update ke apartment', f.buildingType === 'apartment', f.buildingType);
    ok('budget DIBUANG (rentang rumah ≠ rentang apartemen)', !f.budget, JSON.stringify(f.budget));
    ok('fasilitas DIBUANG (fasilitas khas tipe lama)', (f.facilities || []).length === 0,
       JSON.stringify(f.facilities));

    // ── Konsekuensi yang benar-benar dilihat LLM ──
    const r = evaluateListingReadiness(f);
    ok('SYARAT MINIMUM LISTING tetap TERPENUHI setelah ganti tipe',
       r.ready === true, JSON.stringify(r.missing));
    ok('readiness TIDAK melaporkan kota sebagai kurang (pemicu tanya-ulang kota)',
       !r.missing.includes('city'), JSON.stringify(r.missing));
    ok('readiness TIDAK melaporkan sewa/beli sebagai kurang',
       !r.missing.includes('transactionType'), JSON.stringify(r.missing));
  }

  /* ───────────────────────────────────────────────────────────────────────
   * GANTI TRANSAKSI — budget lama TIDAK boleh menyeberang.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 2: GANTI TRANSAKSI (sewa → beli) ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Di area mana? 📍'),
      C('dekat Tunjungan Plaza'),
      A('Kisaran budget?'),
      C('5 juta per bulan'),
      A('Fasilitas apa yang penting?'),
      C('kolam renang'),
    ];
    const f = extractPropertyFilters('ganti, saya mau beli saja', hist);

    ok('transaksi ter-update ke sale', f.transactionType === 'sale', f.transactionType);
    ok('budget SEWA lama DIBUANG (spec item 1: tanyakan budget yang sesuai)',
       !f.budget, JSON.stringify(f.budget));
    ok('kota TETAP Surabaya (spec item 3)', /surabaya/i.test(f.location || ''), f.location);
    ok('landmark TETAP (spec item 4)', /tunjungan/i.test(f.landmark || ''), f.landmark);
    ok('tipe properti TETAP house', f.buildingType === 'house', f.buildingType);
    ok('fasilitas TETAP DICATAT (spec item 7 "diperhatikan", bukan "tanya ulang")',
       (f.facilities || []).length > 0, JSON.stringify(f.facilities));
  }

  /* ───────────────────────────────────────────────────────────────────────
   * GANTI KOTA — landmark kota lama TIDAK boleh menyaring kota baru.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 3: GANTI KOTA (Surabaya → Malang) ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Di area mana? 📍'),
      C('dekat Tunjungan Plaza'),
      A('Kisaran budget?'),
      C('5 juta per bulan'),
      A('Fasilitas apa yang penting?'),
      C('kolam renang'),
    ];
    const f = extractPropertyFilters('eh pindah cari di Malang saja', hist);

    ok('kota ter-update ke Malang', /malang/i.test(f.location || ''), f.location);
    ok('landmark Surabaya DIBUANG (spec item 1: tanyakan ulang landmark)',
       !/tunjungan/i.test(f.landmark || ''), f.landmark);
    ok('transaksi TETAP rent (spec item 2)', f.transactionType === 'rent', f.transactionType);
    ok('tipe TETAP house', f.buildingType === 'house', f.buildingType);
    ok('budget TETAP (spec: hanya landmark yang ditanya ulang)', !!f.budget, JSON.stringify(f.budget));
    ok('fasilitas TETAP (spec item 5 "Fasilitas sama")',
       (f.facilities || []).length > 0, JSON.stringify(f.facilities));
  }

  console.log('\n  KONTROL NEGATIF — perincian kota BUKAN ganti kota:');
  {
    ok('Jakarta → Jakarta Selatan bukan ganti kota',
       isGenuineCityChange('Jakarta', 'Jakarta Selatan') === false);
    ok('Jakarta Selatan → Jakarta bukan ganti kota',
       isGenuineCityChange('Jakarta Selatan', 'Jakarta') === false);
    ok('Surabaya → Malang ADALAH ganti kota',
       isGenuineCityChange('Surabaya', 'Malang') === true);
    ok('kota sama (beda kapital) bukan ganti kota',
       isGenuineCityChange('Surabaya', 'surabaya') === false);
  }

  /* ───────────────────────────────────────────────────────────────────────
   * DUA EKSTRAKTOR HARUS SEPAKAT — inti M154.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 4: kedua ekstraktor sepakat pada percakapan yang SAMA ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Di area atau kawasan mana? 📍'),
      C('dekat Tunjungan Plaza'),
      A('Rencananya masuk bulan apa? 📅'),
      C('bulan Oktober'),
    ];
    const CUR = 'eh, apartemen saja deh';
    const f  = extractPropertyFilters(CUR, hist);
    const st = extractQualificationState(hist, CUR);   // ⚠️ history TANPA pesan saat ini — extractQualificationState menambahkannya sendiri (ALL = history + currentMessage). Menyertakannya dua kali membuat pesan pemicu tidak lagi berada di indeks TERAKHIR, sehingga typeChangedNow (runTypeIdx === lastIdx) selalu false dan banner perubahan tidak pernah muncul.

    ok('kota SAMA di kedua ekstraktor',
       String(f.location || '').toLowerCase() === String(st.city || '').toLowerCase(),
       `filters=${f.location} qualState=${st.city}`);
    ok('transaksi SAMA di kedua ekstraktor',
       String(f.transactionType || '') === String(st.transactionType || ''),
       `filters=${f.transactionType} qualState=${st.transactionType}`);
    ok('tipe SAMA di kedua ekstraktor',
       String(f.buildingType || '') === String(st.buildingType || ''),
       `filters=${f.buildingType} qualState=${st.buildingType}`);
    ok('tanggal masuk TIDAK hilang di qualification state (spec item 5)',
       !!st.moveInDate, String(st.moveInDate));
  }

  /* ───────────────────────────────────────────────────────────────────────
   * MONOTONISITAS di extractQualificationState — reset sempit tidak boleh
   * membuang lebih banyak daripada reset luas.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 5: ganti tipe TIDAK membuang durasi sewa & red flag ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Untuk berapa lama rencananya? ⏳'),
      C('setahun'),
      A('Ada yang pasti tidak cocok? 🚫'),
      C('hindari yang rawan banjir'),
      A('Rencananya masuk bulan apa? 📅'),
      C('bulan Oktober'),
    ];
    // ⚠️ JANGAN pakai kalimat berpagar ("kayaknya apartemen aja") di sini —
    // isConditionalFallbackMessage() memang sengaja MENOLAK membalik tipe untuk
    // kalimat semacam itu (guard M124: "kalau tidak ada X, Y saja" bukan
    // keputusan ganti tipe). Kalimat berpagar akan membuat asersi di bawah lulus
    // untuk alasan yang salah: tipe tidak pernah berubah, jadi tentu saja tidak
    // ada yang di-reset. Pakai pernyataan yang tegas.
    const CUR = 'ganti ke apartemen saja';
    const st = extractQualificationState(hist, CUR);   // ⚠️ history TANPA pesan saat ini — extractQualificationState menambahkannya sendiri (ALL = history + currentMessage). Menyertakannya dua kali membuat pesan pemicu tidak lagi berada di indeks TERAKHIR, sehingga typeChangedNow (runTypeIdx === lastIdx) selalu false dan banner perubahan tidak pernah muncul.

    ok('typeChangedFromHistory menyala', st.typeChangedFromHistory === true);
    ok('leaseDuration BERTAHAN (terikat transaksi, bukan tipe)',
       !!st.leaseDuration, String(st.leaseDuration));
    ok('redFlags BERTAHAN (terikat lokasi, bukan tipe)',
       !!st.redFlags, String(st.redFlags));
    ok('kota BERTAHAN', /surabaya/i.test(st.city || ''), st.city);
    ok('tanggal masuk BERTAHAN', !!st.moveInDate, String(st.moveInDate));
    ok('budget & fasilitas TETAP boleh di-reset (yang memang terikat tipe)',
       st.budget === null && st.facilities === null);
  }

  /* ───────────────────────────────────────────────────────────────────────
   * BANNER — ganti transaksi dulu TIDAK punya banner sama sekali.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 6: banner perubahan konteks ──');
  {
    const noChange = buildSwitchBanners({});
    ok('tanpa perubahan → nol baris (nol token terbuang)', noChange.length === 0);

    const txB = buildSwitchBanners({ txChanged: true, transactionType: 'sale' }).join('\n');
    ok('banner GANTI TRANSAKSI ADA (dulu tidak pernah dibuat)', txB.length > 0);
    ok('banner tx menyebut TRANSAKSI BERUBAH', /TRANSAKSI BERUBAH/i.test(txB));
    ok('banner tx melarang tanya ulang kota', /kota/i.test(txB) && /JANGAN tanya ulang/i.test(txB));
    ok('banner tx melarang tanya ulang jadwal survei', /jadwal survei/i.test(txB));
    ok('banner tx meminta budget rentang baru', /budget/i.test(txB));
    ok('banner tx (beli) meminta metode pembayaran KPR', /KPR/i.test(txB));

    const txRent = buildSwitchBanners({ txChanged: true, transactionType: 'rent' }).join('\n');
    ok('banner tx (sewa) meminta durasi sewa (spec item 8)', /durasi sewa/i.test(txRent));
    ok('banner tx (sewa) TIDAK menyebut KPR', !/KPR/i.test(txRent));

    const cityB = buildSwitchBanners({ cityChanged: true, transactionType: 'rent' }).join('\n');
    ok('banner kota meminta HANYA landmark', /landmark/i.test(cityB));
    ok('banner kota melarang memakai landmark kota lama', /landmark kota LAMA/i.test(cityB));
    ok('banner kota menegaskan fasilitas tetap', /fasilitas/i.test(cityB));

    const typeB = buildSwitchBanners({ typeChanged: true, transactionType: 'rent' }).join('\n');
    ok('banner tipe menegaskan durasi sewa tetap', /durasi sewa/i.test(typeB));
    ok('banner tipe menegaskan red flag tetap', /red flag/i.test(typeB));

    const comp = buildSwitchBanners({ typeChanged: true, txChanged: true, transactionType: 'rent' }).join('\n');
    ok('compound → SATU banner gabungan, bukan dua yang bertumpuk',
       /BERSAMAAN/i.test(comp) && !/KOTA BERUBAH/i.test(comp));
    ok('compound melarang tanya ulang tipe & sewa/beli yang baru saja disebut',
       /JANGAN menanyakan ulang tipe properti atau sewa\/beli/i.test(comp));
  }

  /* ───────────────────────────────────────────────────────────────────────
   * Batas sesi untuk ekstraktor filter (dulu hanya ada di ekstraktor state).
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 7: filter tidak mewarisi pencarian SEBELUM summary ──');
  {
    const hist = [
      C('mau sewa rumah di Surabaya'),
      A('Di area mana?'),
      C('dekat Tunjungan Plaza, budget 5 juta per bulan'),
      A('✓ Rencana: Sewa Rumah di Surabaya\n✓ Budget: 5 juta/bulan'),
      C('sekarang saya mau cari lagi'),
    ];
    const f = extractPropertyFilters('beli ruko di Malang', hist);
    ok('kota dari sesi LAMA tidak bocor', /malang/i.test(f.location || ''), f.location);
    ok('budget sesi LAMA tidak bocor', !f.budget, JSON.stringify(f.budget));
    ok('landmark sesi LAMA tidak bocor', !/tunjungan/i.test(f.landmark || ''), f.landmark);
    ok('tipe & transaksi dari sesi BARU dipakai',
       f.buildingType === 'shophouse' && f.transactionType === 'sale',
       `${f.buildingType}/${f.transactionType}`);
  }

  /* ───────────────────────────────────────────────────────────────────────
   * Kontrak tabel spec — supaya doc skill & kode tidak menyimpang diam-diam.
   * ─────────────────────────────────────────────────────────────────────── */
  console.log('\n── Group 8: kontrak tabel spec ──');
  {
    ok('spec kota membuang HANYA landmark',
       JSON.stringify(CONTEXT_SWITCH_SPEC.city.forgetFilters) === JSON.stringify(['landmark']));
    ok('spec transaksi membuang HANYA budget',
       JSON.stringify(CONTEXT_SWITCH_SPEC.transaction.forgetFilters) === JSON.stringify(['budget']));
    ok('spec tipe TIDAK membuang location/landmark/transactionType',
       !CONTEXT_SWITCH_SPEC.type.forgetFilters.some((x) =>
         ['location', 'landmark', 'transactionType'].includes(x)));
    ok('spec tipe menyatakan leaseDuration & redFlags haram ditanya ulang',
       CONTEXT_SWITCH_SPEC.type.neverReask.includes('leaseDuration') &&
       CONTEXT_SWITCH_SPEC.type.neverReask.includes('redFlags'));

    // applyFilterSwitchPolicy tidak boleh menyentuh apa pun saat tak ada perubahan.
    const untouched = { buildingType: 'house', transactionType: 'rent', location: 'Surabaya',
                        landmark: 'TP', budget: { min: 1 }, facilities: ['gym'], fallbackTypes: ['x'] };
    const after = applyFilterSwitchPolicy({ ...untouched }, {});
    ok('tanpa perubahan → akumulator utuh',
       JSON.stringify(after) === JSON.stringify(untouched));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
