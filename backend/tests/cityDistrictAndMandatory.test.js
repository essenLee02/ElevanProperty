/**
 * cityDistrictAndMandatory.test.js
 *
 * (A) ISTILAH: `city` vs `district` — "location" DILARANG sebagai nama slot.
 *     "Lokasi" ambigu (kota ATAU area), dan kerancuan itu berulang kali
 *     membuat jawaban kota tersimpan ke slot area dan sebaliknya. Slot kanonik:
 *       city     → Q2  (Surabaya, Malang, Bali)
 *       district → Q2c (Ngagel, Pakuwon, Merr, Sidotopo)
 *     `location` dipertahankan HANYA sebagai alias baca untuk kode/tes lama.
 *
 * (B) KATEGORI PERTANYAAN (spesifikasi user, 3 Agu 2026):
 *     WAJIB (memblokir summary): transaksi · tipe · KOTA · budget · fasilitas ·
 *       avoiding&preference · jadwal survei · tanggal masuk
 *     OPSIONAL (TIDAK memblokir): area/district · furnitur · patokan ·
 *       keputusan bersama
 *     Dulu Q6 (patokan) dan Q7 (area alternatif) IKUT memblokir — keliru:
 *     AI menahan brief demi pertanyaan yang boleh saja tidak dijawab.
 *
 * (C) PENOLAKAN = TERJAWAB untuk: jadwal survei · area lain · keputusan ·
 *     patokan · budget (saat AI menyarankan harga) · kota alternatif.
 */
const { extractQualificationState, buildQualificationStateBlock } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── (A) city vs district — dua slot, dua nama ──');
{
  const st = extractQualificationState([
    u('booking apartemen di Surabaya, area Ngagel'),
    a('Selain Surabaya, area sekitar yang masih oke? 🗺️'),
  ], 'Gk mau');
  ok('city = Surabaya (KOTA)',        st.city === 'Surabaya');
  ok('district = Ngagel (AREA)',      st.district === 'Ngagel');
  ok('kota tidak bocor ke district',  st.district !== 'Surabaya');
  ok('area tidak bocor ke city',      st.city !== 'Ngagel');
  ok('alias location = city',         st.location === st.city);
}

/* ══════════════════════════════════════════════════════════════════════════
 * (B) EMPAT SLOT INTI memblokir summary — sisanya TIDAK (2 Sep 2026).
 *
 * ⚠️ KONTRAK INI SENGAJA DIUBAH. Sebelumnya DELAPAN field memblokir summary
 * (budget, fasilitas, red flags, jadwal survei, tanggal masuk, pembiayaan).
 * Itu membuat state block mencetak "🚫 SUMMARY DIBLOKIR" hampir sepanjang
 * percakapan, sehingga AI terpaksa terus meng-interview sampai semuanya
 * terisi — persis kegagalan di transkrip 2 Sep: customer minta listing 3x,
 * menolak survei, bilang "saya tanya saja dulu", dan tetap ditembak
 * "cash atau KPR?" lalu "DP berapa persen?".
 *
 * skill doc 04 §3.1 SUDAH lama menulis "BLOCKING (4) — and only these four"
 * dan menandai daftar-8 sebagai "the interview engine". Kode-lah yang
 * tertinggal; blok state (kode) menang atas doc, jadi doc benar tapi tidak
 * pernah berlaku. Tes ini sekarang mengunci versi 4-slot supaya kode & doc
 * tidak bisa menyimpang lagi.
 * ══════════════════════════════════════════════════════════════════════════ */
console.log('\n── (B) 4 slot inti memblokir summary, sisanya tidak ──');
{
  const lengkap = {
    transactionType: 'rent', buildingType: 'apartment', city: 'Surabaya',
    district: 'Ngagel',
    // semua NON-BLOCKING sengaja dikosongkan:
    budget: null, facilities: null, redFlags: null, viewingDate: null,
    moveInDate: null, financing: null, furnishing: null,
    anchorPoint: null, decisionMaker: null,
  };
  const blocked = (s) => /SUMMARY DIBLOKIR/.test(buildQualificationStateBlock(s, {}));

  ok('4 slot inti ✅ + SEMUA sisanya kosong → TIDAK diblokir', !blocked(lengkap));

  for (const [field, label] of [
    ['transactionType', 'transaksi'], ['buildingType', 'tipe properti'],
    ['city', 'kota'],
  ]) {
    ok(`inti "${label}" kosong → diblokir`, blocked({ ...lengkap, [field]: null }));
  }

  // Slot ke-4 = lokasi spesifik: district ATAU anchorPoint, mana pun yang ada.
  ok('area kosong TAPI patokan ada → TIDAK diblokir',
     !blocked({ ...lengkap, district: null, anchorPoint: 'dekat Pakuwon' }));
  ok('area DAN patokan sama-sama kosong → diblokir',
     blocked({ ...lengkap, district: null, anchorPoint: null }));

  // Yang DULU wajib — sekarang tidak boleh menahan summary sama sekali.
  for (const [field, label] of [
    ['budget', 'budget'], ['facilities', 'fasilitas'], ['redFlags', 'avoiding & preference'],
    ['viewingDate', 'jadwal survei'], ['moveInDate', 'tanggal masuk'],
    ['financing', 'pembiayaan/KPR'], ['furnishing', 'furnitur'],
    ['decisionMaker', 'keputusan bersama'],
  ]) {
    ok(`non-blocking "${label}" kosong → TIDAK diblokir`, !blocked({ ...lengkap, [field]: null }));
  }
}

console.log('\n── (C) Penolakan dihitung sebagai jawaban ──');
{
  const ans = (aiMsg, cust, field) => extractQualificationState(
    [u('sewa apartemen surabaya'), a(aiMsg)], cust
  )[field];

  ok('jadwal survei ditolak → "Minta listing"',
     ans('Kalau mau lihat unitnya, enaknya tanggal berapa? 📅', 'lihat listing saja', 'viewingDate') === 'Minta listing');
  ok('area lain ditolak → tercatat terjawab',
     !!ans('Selain Surabaya, area sekitar yang masih oke? 🗺️', 'Gk mau', 'alternativeAreas'));
  ok('keputusan ditolak → Mandiri',
     ans('langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?', 'Tdk perlu', 'decisionMaker') === 'Mandiri');
  ok('patokan ditolak → tercatat terjawab',
     !!ans('Ada lokasi atau tempat tertentu yang jadi patokan? 📍', 'tidak ada', 'anchorPoint'));
  ok('budget: tawaran AI ditolak → anchor rendah (angka asli, bukan kategori kosong)',
     ans('Di Surabaya ada apartemen kisaran Rp 2.200.000 dan Rp 3.100.000/bulan. Mana yang lebih sesuai?',
         'kemahalan', 'budget') === 'Rp 2.200.000/bulan');
  ok('budget: tawaran AI diterima → rentang tawaran',
     /2\.200\.000/.test(String(ans('Di Surabaya ada apartemen kisaran Rp 2.200.000 dan Rp 3.100.000/bulan. Mana yang lebih sesuai?',
         'sesuai', 'budget'))));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
