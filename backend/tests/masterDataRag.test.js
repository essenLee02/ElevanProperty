/**
 * masterDataRag.test.js — regresi M118.
 *
 * ⚠️ MASALAH. Indeks RAG Node.js hanya memuat `property_knowledge` (38) dan
 * `skill_docs` (131) — TIDAK ADA master data. AI tidak pernah tahu isi tabel
 * cities/facilities/locations/provinces/countries, jadi pertanyaan "ada di
 * kota mana saja?" dijawab dari ingatan model = mengarang.
 *
 * ⚠️ Skor LEKSIKAL, bukan embedding: kredit OpenAI habis (HTTP 429 di log
 * produksi 17 Agu 2026), jadi RAG yang bergantung embedding TIDAK bisa jalan.
 * Tes ini memastikan pencarian tetap bekerja tanpa satu pun panggilan API.
 *
 * Run: node tests/masterDataRag.test.js
 */

'use strict';

const svc = require('../services/masterDataRagService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const ROWS = {
  countries: [{ country_id: 1, name: 'Indonesia' }],
  provinces: [
    { province_id: 11, country_id: 1, name: 'Jawa Timur' },
    { province_id: 12, country_id: 1, name: 'DKI Jakarta' },
  ],
  cities: [
    { city_id: 101, province_id: 11, country_id: 1, name: 'Surabaya' },
    { city_id: 102, province_id: 11, country_id: 1, name: 'Malang' },
    { city_id: 103, province_id: 12, country_id: 1, name: 'Jakarta Selatan' },
  ],
  locations: [
    { location_id: 201, name: 'Pakuwon' },
    { location_id: 202, name: 'Gubeng' },
  ],
  facilities: [
    { facility_id: 301, name: 'Kolam Renang', description: 'Kolam renang bersama', keywords: 'swimming pool, renang' },
    { facility_id: 302, name: 'Carport', description: 'Tempat parkir mobil beratap', keywords: 'garasi, parkir mobil' },
    { facility_id: 303, name: 'Kitchen Set', description: 'Perabot dapur terpasang', keywords: 'dapur, pantry' },
  ],
};

const DOCS = svc.buildMasterDataDocuments(ROWS);

console.log('\n== Group 1: dokumen terbentuk dari SEMUA tabel ==');
{
  const kinds = DOCS.reduce((a, d) => { a[d.kind] = (a[d.kind] || 0) + 1; return a; }, {});
  ok('country terindeks', kinds.country === 1, JSON.stringify(kinds));
  ok('province terindeks', kinds.province === 2, JSON.stringify(kinds));
  ok('city terindeks', kinds.city === 3, JSON.stringify(kinds));
  ok('location terindeks', kinds.location === 2, JSON.stringify(kinds));
  ok('facility terindeks', kinds.facility === 3, JSON.stringify(kinds));

  const sby = DOCS.find((d) => d.id === 'city:101');
  ok('kota membawa hierarki provinsi',
    sby.text.includes('Jawa Timur'), sby.text);
  ok('kota membawa negara', sby.text.includes('Indonesia'), sby.text);
  ok('metadata provinsi terisi', sby.metadata.province === 'Jawa Timur', JSON.stringify(sby.metadata));

  const pool = DOCS.find((d) => d.id === 'facility:301');
  ok('fasilitas memuat keywords dari DB',
    pool.text.toLowerCase().includes('swimming pool'), pool.text);
}

console.log('\n== Group 2: pencarian TANPA embedding ==');
{
  const hits = svc.searchMasterData('ada kota apa saja di Jawa Timur?', DOCS);
  ok('menemukan sesuatu', hits.length > 0, JSON.stringify(hits.map(h => h.doc.id)));
  ok('provinsi/kota Jawa Timur muncul',
    hits.some((h) => /Jawa Timur/i.test(h.doc.text)),
    JSON.stringify(hits.map(h => h.doc.title)));

  const fac = svc.searchMasterData('ada kolam renang?', DOCS, { kind: 'facility' });
  ok('fasilitas kolam renang ditemukan',
    fac[0] && fac[0].doc.title === 'Kolam Renang',
    JSON.stringify(fac.map(h => h.doc.title)));
  ok('filter kind bekerja', fac.every((h) => h.doc.kind === 'facility'));
}

console.log('\n== Group 3: chat malas & singkatan (inti permintaan user) ==');
{
  const hits = svc.searchMasterData('cari rmh di sby', DOCS);
  ok('"sby" menemukan Surabaya',
    hits.some((h) => h.doc.title === 'Surabaya'),
    JSON.stringify(hits.map(h => h.doc.title)));

  const eng = svc.searchMasterData('swimming pool', DOCS);
  ok('kueri bahasa Inggris menemukan fasilitas Indonesia',
    eng.some((h) => h.doc.title === 'Kolam Renang'),
    JSON.stringify(eng.map(h => h.doc.title)));

  const garasi = svc.searchMasterData('ada garasi mobil?', DOCS);
  ok('sinonim dari kolom keywords bekerja (garasi→Carport)',
    garasi.some((h) => h.doc.title === 'Carport'),
    JSON.stringify(garasi.map(h => h.doc.title)));
}

console.log('\n== Group 4: tokenisasi ==');
{
  ok('stopword dibuang', !svc.tokenize('yang untuk dan di ke').length);
  ok('singkatan diurai', svc.tokenize('sby').includes('surabaya'), JSON.stringify(svc.tokenize('sby')));
  ok('tanda baca dibuang', svc.tokenize('Surabaya, Jawa!').includes('surabaya'));
  ok('token 1 huruf dibuang', !svc.tokenize('a b c').length);
}

console.log('\n== Group 5: KONTROL NEGATIF ==');
{
  ok('kueri kosong → tidak ada hasil', svc.searchMasterData('', DOCS).length === 0);
  ok('dokumen kosong → tidak ada hasil', svc.searchMasterData('surabaya', []).length === 0);
  ok('kueri tak relevan tidak memaksakan hasil',
    svc.searchMasterData('cuaca hari ini bagaimana', DOCS, { minScore: 1 }).length === 0);
  ok('limit dihormati',
    svc.searchMasterData('kota', DOCS, { limit: 2 }).length <= 2);
  ok('hasil urut menurun', (() => {
    const h = svc.searchMasterData('kolam renang parkir mobil', DOCS);
    return h.every((x, i) => i === 0 || h[i - 1].score >= x.score);
  })());
}

console.log('\n== Group 6: blok prompt ==');
{
  const block = svc.formatMasterDataBlock(svc.searchMasterData('kolam renang', DOCS));
  ok('blok menandai sumbernya DATABASE', block.includes('BUKAN karangan'), block.slice(0, 80));
  ok('blok memuat isi', block.includes('Kolam Renang'), block);
  ok('blok melarang mengarang nama', block.includes('HANYA nama yang tercantum'), block);
  ok('tanpa hit → blok kosong', svc.formatMasterDataBlock([]) === '');
}

console.log('\n== Group 7: dokumen immutable (IMMUT-3) ==');
{
  const d = DOCS[0];
  const before = d.title;
  try { d.title = 'diubah'; } catch { /* strict mode melempar — juga sah */ }
  ok('dokumen tidak bisa diubah', d.title === before, d.title);
  const rowsCopy = JSON.parse(JSON.stringify(ROWS));
  svc.buildMasterDataDocuments(ROWS);
  ok('baris masukan tidak diubah', JSON.stringify(ROWS) === JSON.stringify(rowsCopy));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);
