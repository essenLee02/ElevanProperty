/**
 * viewingRefusalAndZoneLabels.test.js
 *
 * Tiga bug dari SATU transkrip chatbot web (12 Agu 2026):
 *
 * 1. PENOLAKAN SURVEI TIDAK DIKENALI → pertanyaan yang sama diulang 3× berturut.
 *    Pola lama mensyaratkan `usah|perlu` setelah negasi, sehingga
 *    "Saya tdk mau survei" / "Tdk mau survei" tidak cocok ("mau", bukan
 *    "usah/perlu"; plus singkatan "tdk").
 *
 * 2. "Business District" DIANGGAP NAMA KOTA → bot bertanya "Di area mana di
 *    *Business District*?". Label zona berbahasa Inggris dari judul/area listing
 *    ikut masuk daftar lokasi dikenal; karena daftar diurut TERPANJANG dulu,
 *    "Business District" (17) bahkan mengalahkan kota aslinya "Bengkulu Tengah".
 *
 * 3. "Saya mau durasi booking selama 4 hari" DITOLAK sebagai non-properti oleh
 *    guard Private Agent jalur web — guard-nya tidak ikut mengecek
 *    isPropertyContextContinuation() seperti guard jalur WhatsApp.
 */
const { extractQualificationState } = require('../services/aiPromptBuilderService');
const { detectLocation, getKnownLocations } = require('../services/propertyRecommendationService');
const { isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const Q9B = 'Kalau mau lihat unitnya langsung, enaknya tanggal berapa? 📅 (kalau belum mau survei dulu, boleh balas "lihat listing saja")';
const viewingOf = (ans) => extractQualificationState([u('sewa rumah surabaya'), a(Q9B)], ans).viewingDate;

console.log('\n── (1) Penolakan survei = jawaban SAH ("Minta listing"), bukan slot kosong ──');
{
  // Persis yang diketik customer di produksi — diulang karena tidak dikenali.
  for (const s of ['Saya tdk mau survei', 'Tdk mau survei', 'tidak mau survei',
                   'gak mau survei', 'Saya tidak mau survey', 'tdk mau viewing',
                   'ga mau lihat unit', 'nggak mau survei']) {
    ok(`"${s}" → Minta listing`, viewingOf(s) === 'Minta listing');
  }
  // Bentuk lama harus TETAP bekerja (jangan sampai regresi).
  for (const s of ['ga usah survei', 'tidak perlu survei', 'belum mau survei',
                   'lihat listing saja', 'katalog saja', 'skip', 'nanti saja']) {
    ok(`(lama) "${s}" → Minta listing`, viewingOf(s) === 'Minta listing');
  }
}

console.log('\n── (1b) Tanggal SUNGGUHAN tetap terbaca sebagai tanggal ──');
{
  for (const s of ['20 Agustus', 'besok', 'minggu depan']) {
    const v = viewingOf(s);
    ok(`"${s}" → tanggal (bukan Minta listing)`, !!v && v !== 'Minta listing');
  }
}

console.log('\n── (2) Label zona generik BUKAN nama kota ──');
{
  const GENERIC = ['Business District', 'Industrial Area', 'Heritage Zone', 'Near Airport',
                   'City Center', 'Near Beach', 'Green Zone', 'Waterfront', 'Near Mall'];
  const known = getKnownLocations().map(l => String(l).toLowerCase());
  for (const g of GENERIC) {
    ok(`"${g}" tidak ada di daftar lokasi dikenal`, !known.includes(g.toLowerCase()));
  }
  ok('"Business District" sendiri → bukan lokasi', detectLocation('Business District') === '');

  // M144: dua assertion "judul listing -> kota asli" DIPINDAH ke blok async
  // di akhir berkas. "Bengkulu Tengah" & "Kepi" adalah kota NYATA di tabel
  // `cities`, tapi detectLocation() baru mengenalinya setelah initCityCache()
  // dihangatkan (produksi menghangatkannya saat boot). Sebelum M144 tes ini
  // lulus karena kosakata lokasi ikut diambil dari katalog JSON; begitu JSON
  // dihapus, cache dingin membuatnya gagal PALSU. Jebakan yang sama sudah
  // tercatat untuk _landmarkCache (M139).

  // Kota sungguhan tidak boleh ikut tersaring.
  ok('kota nyata tetap terdeteksi (Surabaya)', detectLocation('Saya mau di Surabaya') === 'Surabaya');
  ok('kota nyata tetap terdeteksi (Malang)',   detectLocation('Di Malang') === 'Malang');
}

console.log('\n── (3) Pesan durasi booking di tengah alur = lanjutan properti ──');
{
  const hist = [
    u('Saya mau booking rumah'),
    a('Mau saya bantu proses booking untuk salah satu rumah ini, Kak?'),
  ];
  ok('"Saya mau durasi booking selama 4 hari" lolos sebagai lanjutan',
     isPropertyContextContinuation('Saya mau durasi booking selama 4 hari', hist));

  // Dan durasinya memang tertangkap begitu pesannya tidak lagi dibuang.
  const st = extractQualificationState([u('booking rumah surabaya'), a('Oke')],
                                       'Saya mau durasi booking selama 4 hari');
  ok('durasi "4 hari" tertangkap', st.leaseDuration === '4 hari');
}

console.log('\n── Transkrip penuh: alur maju, tidak mengulang, sisa 1 field ──');
{
  const H = [
    u('Saya mau booking rumah'),
    a('Di *kota* mana yang Anda pertimbangkan?'), u('Di Surabaya'),
    a('Di area atau kawasan mana di Surabaya?'), u('Area Wonokromo'),
    a('Sudah lihat berapa rumah di Surabaya?'), u('Cari yang ber-AC, ada lemari dan kulkas, serta semi furnished'),
    a('Di Surabaya ada house kisaran 3 juta dan 4 juta. Mana lebih sesuai?'), u('Cari yg harga 300-400K saja'),
    a('Nanti akan tinggal bersama siapa saja?'), u('Sendirian'),
    a('Ada yang pasti tidak cocok?'), u('Saya mau akses jalan lebar dan hadap selatan'),
    a('Selain area Wonokromo, apakah area sekitar masih oke?'), u('Tidak mau.. Pastikan lokasi tdk banjir'),
    a('Kalau nanti ada yang cocok, langsung jadwalkan viewing atau koordinasi dulu?'), u('Tidak perlu'),
    a(Q9B),
  ];
  const st = extractQualificationState(H, 'Saya tdk mau survei');
  ok('kota = Surabaya',            st.city === 'Surabaya');
  ok('area = Wonokromo',           st.district === 'Wonokromo');
  ok('budget tertangkap',          /300\.000/.test(st.budget || ''));
  ok('penghuni tertangkap',        !!st.household);
  ok('furnitur = semi-furnished',  /semi/i.test(st.furnishing || ''));
  ok('viewing = Minta listing (TIDAK ditanya ulang)', st.viewingDate === 'Minta listing');
  ok('keputusan = Mandiri',        st.decisionMaker === 'Mandiri');
  ok('TIDAK ada kota bernama "Business District"', !/business district/i.test(st.city || ''));
}

/* -- Assertion yang MEMBUTUHKAN cache kota hangat (seperti produksi) -- */
(async () => {
  const svc = require('../services/propertyRecommendationService');
  await svc.initCityCache();

  console.log('\n-- (2b) Judul listing resolve ke KOTA ASLI (cache kota hangat) --');
  ok('judul listing -> kota asli ("Bengkulu Tengah")',
     svc.detectLocation('Bengkulu Tengah Business District House') === 'Bengkulu Tengah');
  ok('judul listing -> kota asli ("Kepi")',
     svc.detectLocation('Kepi Near Airport House') === 'Kepi');
  ok('label zona generik TETAP bukan kota walau cache hangat',
     svc.detectLocation('Business District') === '');

  console.log(`\nRESULT: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
