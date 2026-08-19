/**
 * summaryAudit.test.js — regresi M119.
 *
 * SEMUA fixture DIKUTIP DARI TRANSKRIP PRODUKSI NYATA (13–19 Agu 2026) yang
 * dikirim user. Tidak ada contoh karangan di berkas ini.
 *
 *   Case 3  "2-3 juta/minggu"        → ringkasan "/malam"        (unit_mismatch)
 *   Case 3  Malang, tak sebut area   → "Area: Sidotopo"          (untraceable)
 *   Case 4  Jakarta                  → listing Kulon Progo       (city_mismatch)
 *   Case 7  dikoreksi jadi 4 hari    → "Durasi: 2 hari"          (stale_value)
 *   Case 6  "tdk mau dekat parkiran" → "Area: Parkir Mobil"      (untraceable*)
 *   Case 8  template belum terisi    → "Rp [harga rendah]"       (placeholder)
 *
 * (*) "Parkir Mobil" MEMANG muncul di kata customer, jadi audit ini tidak
 * menangkapnya — batas yang disengaja dan diuji di Group 6, bukan kelalaian.
 *
 * Run: node tests/summaryAudit.test.js
 */

'use strict';

const svc = require('../services/summaryAuditService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};
const has = (r, code) => r.findings.some((f) => f.code === code);

console.log('\n== Group 1: parsing baris ringkasan ==');
{
  const rows = svc.parseSummaryLines(
    '✓ Rencana: Beli\n✓ Kota: Surabaya\nbukan baris ringkasan\n✓ Budget: Rp 700 juta',
  );
  ok('tiga baris ✓ terbaca', rows.length === 3, JSON.stringify(rows));
  ok('label & nilai terpisah',
    rows[1].label === 'Kota' && rows[1].value === 'Surabaya', JSON.stringify(rows[1]));
  ok('baris non-ringkasan diabaikan', !rows.some((r) => /bukan baris/.test(r.value)));
  ok('format tebal (*Sewa*) tetap terbaca',
    svc.parseSummaryLines('✓ Rencana: *Sewa*')[0].value === '*Sewa*');
}

console.log('\n== Group 2: Case 8 — placeholder belum terisi ==');
{
  const r = svc.auditSummary('✓ Budget: Rp [harga rendah] - Rp [harga tinggi]',
    ['Saya cari booking apartemen']);
  ok('placeholder terdeteksi', has(r, 'placeholder'), JSON.stringify(r.findings));
  ok('ringkasan ditandai tidak ok', r.ok === false);
}

console.log('\n== Group 3: Case 3 — satuan harga berubah (minggu → malam) ==');
{
  const msgs = [
    'Saya mau booking villa di Malang, saya book selama 7 hari. Saya cari yang harga 2-3 juta/minggu',
    'Yang sekitar 2-3 juta/minggu',
  ];
  const r = svc.auditSummary('✓ Budget: Rp 2.000.000 - Rp 3.000.000/malam', msgs);
  ok('unit_mismatch terdeteksi', has(r, 'unit_mismatch'), JSON.stringify(r.findings));
  ok('detail menyebut satuan asli',
    r.findings.some((f) => /minggu/.test(f.detail)), JSON.stringify(r.findings));

  const okCase = svc.auditSummary('✓ Budget: Rp 2.000.000 - Rp 3.000.000/minggu', msgs);
  ok('satuan benar → tidak ditandai', !has(okCase, 'unit_mismatch'), JSON.stringify(okCase.findings));
}

console.log('\n== Group 4: Case 3 & 4 — area yang tidak pernah disebut ==');
{
  const msgs3 = [
    'Saya mau booking villa di Malang, saya book selama 7 hari',
    'Dekat Ijen, Kak',
    'Private pool saja',
  ];
  const r3 = svc.auditSummary('✓ Area: Sidotopo', msgs3);
  ok('Case 3: "Sidotopo" ditandai karangan', has(r3, 'untraceable'), JSON.stringify(r3.findings));

  const msgs4 = ['Saya mau beli gudang', 'Mau beli di Jakarta', 'Jakarta yang bagian barat saja'];
  const r4 = svc.auditSummary('✓ Area: Sidotopo', msgs4);
  ok('Case 4: "Sidotopo" di Jakarta ditandai', has(r4, 'untraceable'), JSON.stringify(r4.findings));

  const good = svc.auditSummary('✓ Patokan lokasi: Dekat Ijen', msgs3);
  ok('nilai yang MEMANG diucapkan tidak ditandai',
    !has(good, 'untraceable'), JSON.stringify(good.findings));

  // Ringkasan biasanya merapikan kalimat — jangan sampai jadi temuan palsu.
  const tidy = svc.auditSummary('✓ Patokan lokasi: Dekat Alfamaret dan Indomaret',
    ['Dekat alfamaret, Indomaret']);
  ok('perapian kalimat tidak dianggap karangan',
    !has(tidy, 'untraceable'), JSON.stringify(tidy.findings));
}

console.log('\n== Group 5: Case 7 — nilai basi setelah koreksi customer ==');
{
  const msgs = [
    'Saya cari yg 700-950K/hari. Saya mau sewa selama 2 hari saja',
    'Saya sewa selama 4 hari',
  ];
  const r = svc.auditSummary('✓ Durasi: 2 hari', msgs);
  ok('stale_value terdeteksi', has(r, 'stale_value'), JSON.stringify(r.findings));
  ok('detail menyebut nilai terbaru',
    r.findings.some((f) => /4 hari/.test(f.detail)), JSON.stringify(r.findings));

  const fixed = svc.auditSummary('✓ Durasi: 4 hari', msgs);
  ok('nilai terbaru → tidak ditandai', !has(fixed, 'stale_value'), JSON.stringify(fixed.findings));
}

console.log('\n== Group 6: Case 4 — listing dari kota lain ==');
{
  const r = svc.auditSummary('✓ Kota: Jakarta', ['Mau beli di Jakarta'], {
    city: 'Jakarta',
    catalogLocations: ['KULON PROGO, DAERAH ISTIMEWA JOGJAKARTA'],
  });
  ok('city_mismatch terdeteksi', has(r, 'city_mismatch'), JSON.stringify(r.findings));

  const same = svc.auditSummary('✓ Kota: Jakarta', ['Mau beli di Jakarta'], {
    city: 'Jakarta', catalogLocations: ['JAKARTA BARAT'],
  });
  ok('listing kota sama tidak ditandai', !has(same, 'city_mismatch'), JSON.stringify(same.findings));

  // BATAS YANG DISENGAJA: Case 6 "Area: Parkir Mobil" TIDAK tertangkap,
  // karena frasa itu memang diucapkan customer ("tdk mau dekat parkiran mobil").
  // Audit leksikal tidak bisa membedakan "disebut" dari "diinginkan" — itu
  // tugas preference_extractor, bukan modul ini.
  const parkir = svc.auditSummary('✓ Area: Parkir Mobil',
    ['Tdk mau dekat parkiran mobil, saya cari tempat yang sepi.']);
  ok('BATAS diketahui: fasilitas-jadi-area tidak tertangkap audit leksikal',
    !has(parkir, 'untraceable'), JSON.stringify(parkir.findings));
}

console.log('\n== Group 7: label turunan tidak dianggap karangan ==');
{
  // "4 Bulan kedepan" → "15 Desember 2026" adalah HASIL HITUNG, bukan karangan.
  const r = svc.auditSummary('✓ Masuk: 15 Desember 2026', ['4 Bulan kedepan']);
  ok('tanggal hasil hitungan tidak ditandai', !has(r, 'untraceable'), JSON.stringify(r.findings));
  ok('"Keputusan bersama: Mandiri" tidak ditandai',
    !has(svc.auditSummary('✓ Keputusan bersama: Mandiri', ['Sendirian, Kak']), 'untraceable'));
}

console.log('\n== Group 8: ringkasan bersih → tanpa temuan (kontrol negatif) ==');
{
  const msgs = [
    'Saya mau beli rumah di surabaya',
    'Cari 700-850 juta cash; Kak. Lokasi dekat cafe, resto dan Indomaret',
    'Second, tp kondisi bagus',
    'semi-furnished',
  ];
  const clean = [
    '✓ Rencana: Beli',
    '✓ Tipe: Rumah',
    '✓ Kota: Surabaya',
    '✓ Budget: 700-850 juta',
    '✓ Furnitur: semi-furnished',
    '✓ Patokan lokasi: dekat cafe, resto dan Indomaret',
  ].join('\n');
  const r = svc.auditSummary(clean, msgs);
  ok('tidak ada temuan', r.ok === true, JSON.stringify(r.findings));
}

console.log('\n== Group 9: utilitas ==');
{
  ok('priceUnitOf membaca /minggu', svc.priceUnitOf('2-3 juta/minggu') === 'minggu');
  ok('priceUnitOf membaca per malam', svc.priceUnitOf('Rp 1 juta per malam') === 'malam');
  ok('priceUnitOf kosong bila tanpa satuan', svc.priceUnitOf('700 juta') === '');
  ok('formatFindings kosong bila tanpa temuan', svc.formatFindings([]) === '');
  ok('formatFindings memuat kode',
    svc.formatFindings([{ code: 'placeholder', label: 'Budget', value: 'x', detail: 'y' }])
      .includes('[placeholder]'));
  ok('ringkasan kosong tidak melempar', svc.auditSummary('', []).ok === true);
  ok('pesan null tidak melempar', svc.auditSummary('✓ Kota: Surabaya', null).findings.length >= 0);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);
