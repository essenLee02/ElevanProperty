/**
 * investasiGateDrop.test.js
 *
 * Bug produksi (Malang beli-rumah, 7 Agu 2026 — log KIRIMI):
 *
 *   [KIRIMI] ⬇  PESAN MASUK (bukan query properti — tidak dibalas)
 *   [KIRIMI]    Message  : Rumahnya untuk investasi
 *   [KIRIMI]    Status   : ⏭️  Tidak disimpan ke DB, AI skip (bukan query properti)
 *
 * Customer menjawab pertanyaan Q4 ("ditempati bersama siapa?") dengan alasan
 * bahwa rumahnya untuk INVESTASI — jelas soal properti — tapi pesannya DIBUANG
 * gate: tidak disimpan, tidak dibalas, hilang tanpa jejak.
 *
 * DUA gerbang, dua-duanya gagal:
 *   1. hasPropertyKeyword() = (tipe properti + KATA AKSI) OR standalone.
 *      "Rumahnya untuk investasi" punya tipe ("rumah") tapi TIDAK punya kata
 *      aksi — customer menyebut TUJUAN, bukan aksi. → false.
 *   2. isPropertyContextContinuation() butuh history. Customer membalas 9 JAM
 *      kemudian (08:18 → 17:19) sedangkan CHATBOT_COOKIE_TTL_MINUTES=90, jadi
 *      sesi sudah kedaluwarsa → history kosong → langsung return false.
 *
 * FIX: kata TUJUAN/use-case (investasi, ditinggali, untuk usaha, …) masuk
 * ACTION_WORDS. Aman karena ACTION_WORDS hanya berlaku BERSAMA tipe properti —
 * "investasi saham" tetap tidak memicu.
 */
const { hasPropertyKeyword, isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });

console.log('\n── Kasus asli: pesan investasi TIDAK boleh dibuang saat sesi kedaluwarsa ──');
{
  // history KOSONG = sesi sudah lewat TTL, persis kondisi produksi jam 17:19.
  ok('"Rumahnya untuk investasi" lolos gate tanpa history', hasPropertyKeyword('Rumahnya untuk investasi'));
  ok('"rumah ini untuk investasi" lolos', hasPropertyKeyword('rumah ini untuk investasi'));
  ok('"apartemen buat investasi" lolos', hasPropertyKeyword('apartemen buat investasi'));
  ok('"rumahnya tidak ditinggali" lolos', hasPropertyKeyword('rumahnya tidak ditinggali'));
  ok('"ruko untuk usaha" lolos', hasPropertyKeyword('ruko untuk usaha'));
}

console.log('\n── Kontrol negatif: investasi NON-properti tetap ditolak ──');
{
  for (const m of ['investasi saham', 'mau investasi emas', 'investasi reksadana', 'saya invest di crypto']) {
    ok(`"${m}" tetap DITOLAK (tidak ada tipe properti)`, !hasPropertyKeyword(m));
  }
}

console.log('\n── Pengecualian "rumah" ambigu tetap berlaku ──');
{
  ok('"rumah makan untuk investasi" tetap DITOLAK', !hasPropertyKeyword('rumah makan untuk investasi'));
  ok('"rumah sakit mau dibangun" tetap DITOLAK',    !hasPropertyKeyword('rumah sakit mau dibangun'));
  ok('"investasi rumah tangga" tetap DITOLAK',      !hasPropertyKeyword('investasi rumah tangga'));
}

console.log('\n── Jawaban telanjang di TENGAH percakapan tetap lolos via continuation ──');
{
  const H = [u('beli rumah di Malang'), a('Nanti akan ditempati bersama siapa saja?')];
  ok('"untuk investasi" (tanpa tipe) lolos karena ada history',
     isPropertyContextContinuation('untuk investasi', H));
  ok('"untuk investasi" TANPA history memang tidak lolos gate kata-kunci (ambigu, benar)',
     !hasPropertyKeyword('untuk investasi'));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
