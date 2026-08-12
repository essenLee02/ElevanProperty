/**
 * userBusinessRules.test.js
 *
 * Aturan users yang SALING TERIKAT (spesifikasi user, 7 Agu 2026):
 *   • ai_primary  : Deepseek | Kimi | Default ("Default" → ikut .env AI_PRIMARY_PROVIDER)
 *   • trans_type  : Sale | Rent | Both
 *   • payment_type: TERIKAT trans_type —
 *       Rent → WAJIB "Cash" (KPR tidak boleh; sewa tidak dibiayai KPR)
 *       Both → WAJIB "Both"
 *       Sale → boleh "Cash" | "KPR" | "Both"
 *   • rental_duration + rental_type: hanya untuk Rent/Both; Sale WAJIB null
 *
 * Dipakai bersama oleh register & profile — satu sumber kebenaran, supaya kedua
 * jalur tidak bisa melenceng satu sama lain.
 */
const {
  validateUserBusinessFields, allowedPaymentTypes, supportsRental,
  AI_PRIMARY_UI_OPTIONS, RENTAL_TYPES,
} = require('../utils/userBusinessRules');
const { getPrimaryAIProvider } = require('../services/aiProviderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };
const V = (input, current) => validateUserBusinessFields(input, current);

console.log('\n── payment_type TERIKAT trans_type ──');
{
  ok('Rent → hanya Cash yang sah', JSON.stringify(allowedPaymentTypes('Rent')) === JSON.stringify(['Cash']));
  ok('Both → hanya Both yang sah', JSON.stringify(allowedPaymentTypes('Both')) === JSON.stringify(['Both']));
  ok('Sale → Cash/KPR/Both sah',   allowedPaymentTypes('Sale').length === 3);

  const rentKpr = V({ trans_type: 'Rent', payment_type: 'KPR' });
  ok('Rent + KPR DITOLAK (sewa tidak dibiayai KPR)', !rentKpr.ok && /KPR|Cash/i.test(rentKpr.error));

  const bothCash = V({ trans_type: 'Both', payment_type: 'Cash' });
  ok('Both + Cash DITOLAK (Both harus Both)', !bothCash.ok);

  for (const p of ['Cash', 'KPR', 'Both']) {
    const r = V({ trans_type: 'Sale', payment_type: p });
    ok(`Sale + ${p} diterima`, r.ok && r.values.payment_type === p);
  }
}

console.log('\n── Default otomatis saat payment_type tidak dikirim ──');
{
  ok('Rent tanpa payment_type → Cash', V({ trans_type: 'Rent' }).values.payment_type === 'Cash');
  ok('Both tanpa payment_type → Both', V({ trans_type: 'Both' }).values.payment_type === 'Both');
  ok('Sale tanpa payment_type → Cash (opsi pertama)', V({ trans_type: 'Sale' }).values.payment_type === 'Cash');
}

console.log('\n── Ganti trans_type saja: payment_type lama yang bentrok diperbaiki, bukan ditolak ──');
{
  // Kasus nyata di halaman profile: user hanya mengubah dropdown trans_type.
  // payment_type lama ("KPR") tidak ikut terkirim — menolak simpan di sini akan
  // membingungkan karena user tidak menyentuh field itu.
  const r = V({ trans_type: 'Rent' }, { trans_type: 'Sale', payment_type: 'KPR' });
  ok('Sale/KPR → pindah ke Rent → payment_type otomatis Cash', r.ok && r.values.payment_type === 'Cash');

  const r2 = V({ trans_type: 'Both' }, { trans_type: 'Sale', payment_type: 'KPR' });
  ok('Sale/KPR → pindah ke Both → payment_type otomatis Both', r2.ok && r2.values.payment_type === 'Both');
}

console.log('\n── rental_duration / rental_type ──');
{
  ok('supportsRental(Rent) true',  supportsRental('Rent'));
  ok('supportsRental(Both) true',  supportsRental('Both'));
  ok('supportsRental(Sale) false', !supportsRental('Sale'));

  const good = V({ trans_type: 'Rent', rental_duration: 3, rental_type: 'Month' });
  ok('Rent + 3 Month diterima', good.ok && good.values.rental_duration === 3 && good.values.rental_type === 'Month');

  const saleWithRental = V({ trans_type: 'Sale', rental_duration: 3, rental_type: 'Month' });
  ok('Sale + durasi sewa DITOLAK (bukan dibuang diam-diam)',
     !saleWithRental.ok && /Rent.*Both|hanya berlaku/i.test(saleWithRental.error));

  ok('Sale tanpa rental → rental_* null',
     V({ trans_type: 'Sale' }).values.rental_duration === null);

  const halfA = V({ trans_type: 'Rent', rental_duration: 3 });
  ok('durasi tanpa satuan DITOLAK', !halfA.ok);
  const halfB = V({ trans_type: 'Rent', rental_type: 'Month' });
  ok('satuan tanpa durasi DITOLAK', !halfB.ok);

  ok('Rent tanpa rental sama sekali → null (opsional)',
     V({ trans_type: 'Rent' }).values.rental_duration === null);

  ok('durasi 0 DITOLAK',      !V({ trans_type: 'Rent', rental_duration: 0,  rental_type: 'Day' }).ok);
  ok('durasi negatif DITOLAK', !V({ trans_type: 'Rent', rental_duration: -2, rental_type: 'Day' }).ok);
  ok('satuan ngawur DITOLAK',  !V({ trans_type: 'Rent', rental_duration: 2,  rental_type: 'Dekade' }).ok);

  for (const rt of RENTAL_TYPES) {
    ok(`satuan "${rt}" diterima`, V({ trans_type: 'Rent', rental_duration: 1, rental_type: rt }).ok);
  }
}

console.log('\n── BUG 12 Agu 2026: pindah ke Sale saat rental SUDAH terisi harus BISA disimpan ──');
{
  // Kondisi nyata: agent punya rental_duration=3 / rental_type=Month tersimpan,
  // lalu memilih Transaction Type "Sale". Frontend menyembunyikan input rental
  // dan mengosongkannya, sehingga mengirim null EKSPLISIT. Cek lama memakai
  // String(v).trim() !== '' — dan String(null) = "null" (bukan "") — sehingga
  // nilai yang SUDAH dikosongkan malah dianggap "user mengirim durasi untuk
  // Sale". Akibatnya profil TIDAK BISA disimpan sama sekali, dan agent tidak
  // punya jalan keluar karena field-nya tidak lagi terlihat di layar.
  const stored = { trans_type: 'Both', payment_type: 'Both', rental_duration: 3, rental_type: 'Month' };

  const viaNull = V({ trans_type: 'Sale', payment_type: 'Cash', rental_duration: null, rental_type: null }, stored);
  ok('null EKSPLISIT diterima (bukan dianggap "diisi")', viaNull.ok);
  ok('rental_* jadi null setelah pindah ke Sale',
     viaNull.ok && viaNull.values.rental_duration === null && viaNull.values.rental_type === null);
  ok('trans_type & payment_type tersimpan benar',
     viaNull.ok && viaNull.values.trans_type === 'Sale' && viaNull.values.payment_type === 'Cash');

  ok('string kosong juga diterima',
     V({ trans_type: 'Sale', rental_duration: '', rental_type: '' }, stored).ok);
  ok('field TIDAK dikirim sama sekali juga diterima',
     V({ trans_type: 'Sale' }, stored).ok);
  ok('spasi saja juga diterima',
     V({ trans_type: 'Sale', rental_duration: '  ', rental_type: '  ' }, stored).ok);

  // Penjaga sesungguhnya harus TETAP bekerja: nilai BERISI untuk Sale ditolak.
  ok('nilai BERISI untuk Sale TETAP ditolak',
     !V({ trans_type: 'Sale', rental_duration: 3, rental_type: 'Month' }, stored).ok);
  ok('salah satu berisi untuk Sale TETAP ditolak',
     !V({ trans_type: 'Sale', rental_duration: 3 }, stored).ok);
}

console.log('\n── Nilai rental tersimpan tidak ikut "bocor" saat pindah ke Sale ──');
{
  // current punya rental, input tidak menyebut rental sama sekali → hasil WAJIB
  // null, bukan mewarisi 3/Month dari current (Sale tidak boleh punya durasi).
  const r = V({ trans_type: 'Sale' }, { trans_type: 'Rent', payment_type: 'Cash', rental_duration: 7, rental_type: 'Day' });
  ok('rental_duration tersimpan TIDAK diwariskan ke Sale', r.ok && r.values.rental_duration === null);
  ok('rental_type tersimpan TIDAK diwariskan ke Sale',     r.ok && r.values.rental_type === null);
}

console.log('\n── ai_primary ──');
{
  for (const v of AI_PRIMARY_UI_OPTIONS) {
    ok(`"${v}" diterima`, V({ ai_primary: v }).ok);
  }
  ok('case-insensitive ("deepseek" → "Deepseek")', V({ ai_primary: 'deepseek' }).values.ai_primary === 'Deepseek');
  ok('tanpa nilai → "Default"', V({}).values.ai_primary === 'Default');
  ok('nilai ngawur DITOLAK', !V({ ai_primary: 'SkyNet' }).ok);
}

console.log('\n── ai_primary → provider yang benar-benar dipakai ──');
{
  const prev = process.env.AI_PRIMARY_PROVIDER;
  process.env.AI_PRIMARY_PROVIDER = 'kimi';
  ok('"Default" → ikut .env (kimi)',       getPrimaryAIProvider('Default') === 'kimi');
  ok('kosong → ikut .env (kimi)',          getPrimaryAIProvider('') === 'kimi');
  ok('"Deepseek" MENGALAHKAN .env',        getPrimaryAIProvider('Deepseek') === 'deepseek');
  ok('"Kimi" eksplisit tetap kimi',        getPrimaryAIProvider('Kimi') === 'kimi');

  process.env.AI_PRIMARY_PROVIDER = 'deepseek';
  ok('.env berubah → "Default" ikut berubah', getPrimaryAIProvider('Default') === 'deepseek');
  ok('pilihan agent tidak terpengaruh .env',  getPrimaryAIProvider('Kimi') === 'kimi');
  process.env.AI_PRIMARY_PROVIDER = prev;
}

console.log('\n── Normalisasi kapitalisasi ──');
{
  const r = V({ trans_type: 'rent', payment_type: 'cash', rental_type: 'month', rental_duration: '5' });
  ok('input lowercase dinormalkan ke bentuk kanonik',
     r.ok && r.values.trans_type === 'Rent' && r.values.payment_type === 'Cash' && r.values.rental_type === 'Month');
  ok('durasi string "5" jadi angka 5', r.values.rental_duration === 5);
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
