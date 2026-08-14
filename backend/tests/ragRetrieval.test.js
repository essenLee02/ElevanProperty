/**
 * ragRetrieval.test.js
 *
 * Mengunci invarian lapisan RAG (chunker · embedding · vector store · retrieval).
 *
 * KENAPA TES INI ADA — empat kelas kegagalan yang akan MAHAL bila lolos:
 *
 *  1. TABEL MARKDOWN TERPOTONG. Skill docs penuh tabel yang maknanya terbalik
 *     bila dipotong (Hindari↔Prefer, tier budget, BENAR/SALAH Q7). Potongan
 *     tabel yang rusak = aturan menyesatkan yang disuntikkan ke prompt.
 *
 *  2. KEBOCORAN ANTAR-AGENT. Katalog di proyek ini SELALU di-scope ke
 *     Property.user_id. Indeks vektor yang bocor membuat agent A
 *     merekomendasikan properti milik agent B — kebocoran data bisnis nyata.
 *
 *  3. VEKTOR BEDA MODEL DIBANDINGKAN. Cosine antar ruang vektor berbeda
 *     menghasilkan angka yang tampak valid tapi tidak bermakna — bug senyap.
 *
 *  4. RAG MEMUTUS PERCAKAPAN. RAG adalah pelengkap. Setiap kegagalan WAJIB
 *     menghasilkan string kosong (nol token, perilaku persis sebelum RAG ada).
 *
 * Semua tes berjalan OFFLINE (RAG_EMBEDDING_MODE=local) — 49 berkas tes lain
 * di proyek ini juga tidak butuh jaringan, jangan rusak disiplin itu.
 */

process.env.RAG_EMBEDDING_MODE = 'local';

const { chunkMarkdown, toEmbeddableText, markProtectedLines } = require('../utils/ragChunker');
const embeddingService = require('../services/embeddingService');
const vectorStore = require('../services/vectorStoreService');
const ragRetrieval = require('../services/ragRetrievalService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

// ─── Group 1: chunker tidak pernah merusak tabel ──────────────────────────────
console.log('\n[1] Chunker — integritas tabel & breadcrumb');

const DOC_WITH_TABLE = `# Doc Uji

## Bagian Satu

Paragraf pembuka bagian satu.

### Tabel Tier Budget

| Property | Transaksi | Terjangkau | Menengah | Eksklusif |
|---|---|---|---|---|
| House | Beli | Rp 350-900 jt | Rp 900 jt-3 M | Rp 3-15 M+ |
| House | Sewa | Rp 20-60 jt/thn | Rp 60-180 jt/thn | Rp 180-600 jt/thn |
| Apartment | Beli | Rp 350-800 jt | Rp 800 jt-2,5 M | Rp 2,5-10 M+ |
| Villa | Beli | Rp 800 jt-3 M | Rp 3-10 M | Rp 10-100 M+ |

## Bagian Dua

Isi bagian dua.
`;

const tableChunks = chunkMarkdown(DOC_WITH_TABLE, { source: 'uji.md', maxChars: 200 });

// maxChars sengaja 200 — jauh di bawah ukuran tabel. Tabel HARUS tetap utuh.
const chunkWithTable = tableChunks.find((c) => c.text.includes('| House | Beli'));
ok('tabel ditemukan dalam satu chunk', Boolean(chunkWithTable));
ok('seluruh 4 baris data tabel tetap dalam SATU chunk',
  chunkWithTable
  && chunkWithTable.text.includes('| House | Beli')
  && chunkWithTable.text.includes('| House | Sewa')
  && chunkWithTable.text.includes('| Apartment | Beli')
  && chunkWithTable.text.includes('| Villa | Beli'));
ok('header tabel ikut dalam chunk yang sama (tanpa header, baris tak bermakna)',
  chunkWithTable && chunkWithTable.text.includes('| Property | Transaksi |'));

ok('breadcrumb memuat heading induk berjenjang',
  chunkWithTable && chunkWithTable.breadcrumb.includes('Bagian Satu')
  && chunkWithTable.breadcrumb.includes('Tabel Tier Budget'));
ok('breadcrumb diawali nama sumber', chunkWithTable && chunkWithTable.breadcrumb.startsWith('uji.md'));
ok('toEmbeddableText menyertakan breadcrumb (konteks ikut di-embed)',
  toEmbeddableText(chunkWithTable).includes('[uji.md'));

// Kontrol negatif: blok kode juga tidak boleh dipotong
const fenced = markProtectedLines(['teks', '```js', 'const a = 1;', '', 'const b = 2;', '```', 'teks']);
ok('baris kosong DI DALAM blok kode ditandai terlindungi', fenced[3] === true);
ok('baris di luar blok kode TIDAK ditandai terlindungi', fenced[0] === false && fenced[6] === false);

// ─── Group 2: embedding deterministik & normalisasi ───────────────────────────
console.log('\n[2] Embedding — determinisme & kemiripan');

const v1 = embeddingService.embedLocal('rumah dijual di surabaya dekat pakuwon');
const v2 = embeddingService.embedLocal('rumah dijual di surabaya dekat pakuwon');
const v3 = embeddingService.embedLocal('gudang disewakan di semarang dekat tol');

ok('embedding lokal deterministik (teks sama → vektor identik)',
  v1.length === v2.length && v1.every((x, i) => x === v2[i]));
ok('vektor ternormalisasi L2 (panjang = 1)',
  Math.abs(Math.sqrt(v1.reduce((s, x) => s + x * x, 0)) - 1) < 1e-9);
ok('teks identik → cosine = 1', Math.abs(embeddingService.cosineSimilarity(v1, v2) - 1) < 1e-9);
ok('teks berbeda topik → cosine jauh lebih rendah daripada teks identik',
  embeddingService.cosineSimilarity(v1, v3) < embeddingService.cosineSimilarity(v1, v2));
ok('teks kosong tidak melempar error', Array.isArray(embeddingService.embedLocal('')));

// ─── Group 3: ISOLASI ANTAR-AGENT (paling kritis) ─────────────────────────────
console.log('\n[3] Vector store — isolasi antar-agent & guard model');

vectorStore._resetForTests();

const catalogDocs = [
  { id: 'p1', text: 'Rumah dijual di Surabaya, 3 kamar tidur, dekat Pakuwon.', metadata: { user_id: 'AGENT_A', building_type: 'house', transaction_type: 'sale' } },
  { id: 'p2', text: 'Rumah dijual di Surabaya, 4 kamar tidur, dekat Citraland.', metadata: { user_id: 'AGENT_A', building_type: 'house', transaction_type: 'sale' } },
  { id: 'p3', text: 'Rumah dijual di Surabaya, 3 kamar tidur, dekat Pakuwon.', metadata: { user_id: 'AGENT_B', building_type: 'house', transaction_type: 'sale' } },
  { id: 'p4', text: 'Gudang disewakan di Surabaya dekat tol.', metadata: { user_id: 'AGENT_B', building_type: 'warehouse', transaction_type: 'rent' } }
];

catalogDocs.forEach((d) => { d.vector = embeddingService.embedLocal(d.text); });
vectorStore.addDocuments('agent_catalog', catalogDocs, 'local-hash-512');

const query = embeddingService.embedLocal('rumah di surabaya dekat pakuwon');

const forA = vectorStore.search('agent_catalog', query, {
  topK: 10, minScore: 0, filter: (m) => String(m.user_id) === 'AGENT_A'
});
const forB = vectorStore.search('agent_catalog', query, {
  topK: 10, minScore: 0, filter: (m) => String(m.user_id) === 'AGENT_B'
});

ok('agent A hanya menerima properti miliknya', forA.length > 0 && forA.every((h) => h.metadata.user_id === 'AGENT_A'));
ok('agent B hanya menerima properti miliknya', forB.length > 0 && forB.every((h) => h.metadata.user_id === 'AGENT_B'));
ok('KONTROL NEGATIF: properti agent B TIDAK pernah muncul untuk agent A',
  forA.every((h) => h.id !== 'p3' && h.id !== 'p4'));
ok('KONTROL NEGATIF: meski TEKSNYA IDENTIK, p3 (agent B) tidak bocor ke agent A',
  forA.some((h) => h.id === 'p1') && !forA.some((h) => h.id === 'p3'));

const houseOnly = vectorStore.search('agent_catalog', query, {
  topK: 10, minScore: 0,
  filter: (m) => String(m.user_id) === 'AGENT_B' && m.building_type === 'house'
});
ok('filter tipe properti ikut dihormati', houseOnly.length === 1 && houseOnly[0].id === 'p3');

// Guard model: menambah vektor dari model lain harus MEMBUANG indeks lama,
// bukan mencampurnya.
vectorStore.addDocuments('agent_catalog', [
  { id: 'x1', text: 'lain', vector: [0.1, 0.2, 0.3], metadata: { user_id: 'AGENT_A' } }
], 'model-lain-3');
const afterModelSwitch = vectorStore.search('agent_catalog', query, { topK: 10, minScore: 0 });
ok('KONTROL NEGATIF: ganti model → indeks lama dibuang, bukan dicampur',
  afterModelSwitch.length === 0);

// ─── Group 4: fail-open ───────────────────────────────────────────────────────
console.log('\n[4] Fail-open — RAG tidak boleh pernah memutus percakapan');

(async () => {
  const originalFlag = process.env.RAG_ENABLED;

  process.env.RAG_ENABLED = 'OFF';
  const disabled = await ragRetrieval.buildRagContext({ customerMessage: 'mau beli rumah', history: [] });
  ok('RAG_ENABLED=OFF → string kosong (nol token, perilaku pra-RAG)', disabled === '');

  process.env.RAG_ENABLED = 'ON';
  vectorStore._resetForTests();
  const emptyIndex = await ragRetrieval.buildRagContext({ customerMessage: 'mau beli rumah', history: [] });
  ok('indeks kosong → string kosong, bukan error', emptyIndex === '');

  const noMessage = await ragRetrieval.buildRagContext({ customerMessage: '', history: [] });
  ok('pesan kosong → string kosong', noMessage === '');

  // Katalog tanpa identitas agent HARUS kosong — bukan "tampilkan semua".
  vectorStore._resetForTests();
  vectorStore.addDocuments('agent_catalog', catalogDocs.map((d) => ({ ...d })), 'local-hash-512');
  const noAgent = await ragRetrieval.retrieveAgentCatalog('rumah surabaya', null);
  ok('KONTROL NEGATIF: tanpa agentUserId → katalog KOSONG (tidak bocor lintas agent)', noAgent === '');

  const withAgent = await ragRetrieval.retrieveAgentCatalog('rumah surabaya dekat pakuwon', 'AGENT_A');
  ok('dengan agentUserId → katalog terisi', withAgent.length > 0);
  ok('blok katalog memuat larangan mengarang listing',
    withAgent.includes('Jangan pernah mengarang'));

  // ⚠️ Kontrol paling kritis di seluruh berkas ini: buildRagContext() dipanggil
  // pada SETIAP giliran termasuk selama Q1–Q12 masih berjalan. Bila katalog
  // ikut tanpa diminta eksplisit, semantic search bisa membocorkan rekomendasi
  // SEBELUM brief tampil — pelanggaran langsung "❌ Never show listings
  // mid-interview" (SKILL.md §4). includeAgentCatalog HARUS default false.
  const withoutFlag = await ragRetrieval.buildRagContext({
    customerMessage: 'rumah surabaya dekat pakuwon', history: [], agentUserId: 'AGENT_A'
  });
  ok('KONTROL NEGATIF: agentUserId diisi TAPI includeAgentCatalog tidak di-set → katalog TIDAK ikut',
    !withoutFlag.includes('LISTING KATALOG'));

  const withFlag = await ragRetrieval.buildRagContext({
    customerMessage: 'rumah surabaya dekat pakuwon', history: [], agentUserId: 'AGENT_A', includeAgentCatalog: true
  });
  ok('includeAgentCatalog:true secara eksplisit → katalog ikut', withFlag.includes('LISTING KATALOG'));

  process.env.RAG_ENABLED = originalFlag;

  // ─── Group 5: kueri & MMR ───────────────────────────────────────────────────
  console.log('\n[5] Pembentukan kueri & keberagaman hasil');

  const q = ragRetrieval.buildQueryText('semi aja', [
    { message: 'mau sewa apartemen di surabaya' },
    { message: 'Untuk furnitur, prefer furnished, semi, atau kosongan?' }
  ]);
  ok('kueri memuat pesan customer terakhir', q.includes('semi aja'));
  ok('kueri memuat konteks giliran sebelumnya (jawaban pendek tetap bermakna)',
    q.includes('apartemen') || q.includes('furnitur'));
  ok('pesan terakhir diulang agar bobotnya dominan',
    (q.match(/semi aja/g) || []).length >= 2);

  const dupDocs = ['teks sangat mirip satu', 'teks sangat mirip satu', 'teks sangat mirip satu', 'topik benar benar berbeda gudang tol']
    .map((t, i) => ({ id: 'd' + i, text: t, vector: embeddingService.embedLocal(t), metadata: {} }));
  vectorStore._resetForTests();
  vectorStore.addDocuments('mmr', dupDocs, 'local-hash-512');
  const qv = embeddingService.embedLocal('teks sangat mirip satu');

  const pureRelevance = vectorStore.search('mmr', qv, { topK: 2, minScore: 0, mmrLambda: 1 });
  const diversified = vectorStore.search('mmr', qv, { topK: 2, minScore: 0, mmrLambda: 0 });
  ok('lambda=1 (murni relevansi) mengembalikan duplikat', pureRelevance.length === 2);
  ok('lambda=0 (murni keberagaman) memilih chunk yang berbeda topik',
    diversified.some((h) => h.id === 'd3'));

  console.log(`\nRESULT: ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
})();
