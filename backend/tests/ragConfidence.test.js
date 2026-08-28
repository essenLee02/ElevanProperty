'use strict';
/**
 * ragConfidence.test.js — M157
 * -----------------------------
 * Menguji gerbang keyakinan RAG: skor terkalibrasi 0..1 dengan ambang 0.45,
 * memutuskan SKIP (diam / balasan default, 0 RAG 0 AI) vs REDIRECT (lanjut ke
 * Platform AI).
 *
 * Dua sifat yang dijaga ketat oleh berkas ini:
 *
 *  1. TIDAK ADA on-topic yang didiamkan. Mendiamkan customer sungguhan jauh
 *     lebih mahal daripada membalas satu pesan off-topic — satu lead hilang
 *     tanpa jejak, dan agent tidak pernah tahu.
 *  2. FAIL-OPEN mutlak. Indeks RAG kosong, modul error, riwayat aneh — semua
 *     harus menghasilkan REDIRECT, bukan SKIP. Saat tes ini ditulis, dua dari
 *     tiga namespace RAG memang masih kosong di produksi.
 *
 * ⚠️ Memanggil MODUL SUNGGUHAN, bukan salinan logika (pelajaran aiPromptBuilder:
 * tes yang menyalin helper tetap hijau sementara produksi crash).
 */
require('dotenv').config();

const {
  scoreConfidence, blend, scoreSlots, scoreLexical, scoreFlow, THRESHOLD,
} = require('../services/ragConfidenceService');

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const Q = (t) => [{ role: 'ai', message: t }];

async function main() {
  console.log('\n=== M157 · Gerbang Keyakinan RAG ===\n');
  console.log(`ambang = ${THRESHOLD}\n`);

  /* ── 1. On-topic WAJIB diteruskan ── */
  console.log('1) Pesan on-topic harus REDIRECT (tidak boleh didiamkan)');
  const onTopic = [
    ['Apakah ada apartemen di Kutisari?', []],
    ['Saya mau beli rumah di Surabaya', []],
    ['KPR berapa lama tenornya', []],
    ['apa itu SHM?', []],
    ['Blh tau SHM itu apa', []],
    ['apakah sudah ada SHMSRS?', []],
    ['Saya minta listing', []],
    ['minta 4 data apartemen', []],
    // Jawaban pendek atas pertanyaan AI — keabsahannya dari KONTEKS, bukan isi.
    ['Kutisari', Q('Di area mana di Surabaya yang Anda pertimbangkan?')],
    ['2 kamar', Q('Berapa kamar yang dibutuhkan?')],
    ['Bsk jam 10', Q('Mau dijadwalkan survei kapan?')],
    ['Semi.. Kak', Q('Untuk furnitur, prefer furnished, semi, atau kosongan?')],
  ];
  for (const [msg, hist] of onTopic) {
    const r = await scoreConfidence({ message: msg, history: hist });
    ok(`REDIRECT: "${msg.slice(0, 44)}"`, r.decision === 'REDIRECT',
      `skor ${r.score.toFixed(3)} — ${r.reason}`);
  }

  /* ── 2. Off-topic & spam harus SKIP ── */
  console.log('\n2) Pesan off-topic / spam harus SKIP (hemat token)');
  const offTopic = [
    'cuaca hari ini gimana',
    'berapa harga bitcoin',
    'resep nasi goreng enak',
    'siapa presiden indonesia',
    'tolong pinjami saya uang 5 juta',
    'PROMO PINJAMAN CEPAT CAIR HUB WA',
  ];
  for (const msg of offTopic) {
    const r = await scoreConfidence({ message: msg, history: [] });
    ok(`SKIP: "${msg.slice(0, 44)}"`, r.decision === 'SKIP',
      `skor ${r.score.toFixed(3)} — ${r.reason}`);
  }

  /* ── 3. Pemisahan populasi ── */
  console.log('\n3) Margin pemisahan on-topic vs off-topic');
  let worstOn = 1; let bestOff = 0;
  for (const [msg, hist] of onTopic) {
    const r = await scoreConfidence({ message: msg, history: hist });
    if (r.score < worstOn) worstOn = r.score;
  }
  for (const msg of offTopic) {
    const r = await scoreConfidence({ message: msg, history: [] });
    if (r.score > bestOff) bestOff = r.score;
  }
  ok('on-topic terburuk masih di atas ambang', worstOn >= THRESHOLD, `${worstOn.toFixed(3)}`);
  ok('off-topic terbaik masih di bawah ambang', bestOff < THRESHOLD, `${bestOff.toFixed(3)}`);
  ok('ada jarak nyata antara dua populasi', worstOn - bestOff > 0.2,
    `on=${worstOn.toFixed(3)} off=${bestOff.toFixed(3)} jarak=${(worstOn - bestOff).toFixed(3)}`);

  /* ── 4. FAIL-OPEN — sifat paling penting di berkas ini ── */
  console.log('\n4) Fail-open: kegagalan TIDAK BOLEH mendiamkan customer');
  {
    const r = await scoreConfidence({ message: '', history: [] });
    ok('pesan kosong → REDIRECT', r.decision === 'REDIRECT', r.reason);
  }
  {
    const r = await scoreConfidence({});
    ok('parameter kosong → REDIRECT', r.decision === 'REDIRECT', r.reason);
  }
  {
    const r = await scoreConfidence({ message: 'Saya mau beli rumah', history: null });
    ok('history null → tidak crash & REDIRECT', r.decision === 'REDIRECT', r.reason);
  }
  {
    // Semua sinyal hilang (null) → blend WAJIB 1, bukan 0. Ini persis keadaan
    // "indeks RAG belum ter-build" yang sedang berlaku di produksi.
    ok('blend() tanpa sinyal apa pun → 1 (fail-open), bukan 0',
      blend({ slot: null, lexical: null, flow: null, vector: null }) === 1);
  }
  {
    const r = await scoreConfidence({
      message: 'Kutisari',
      history: [{ role: 'ai', message: 'Di area mana?' }, { bogus: true }],
    });
    ok('entri history rusak → tidak crash', r.decision === 'REDIRECT', r.reason);
  }

  /* ── 5. Sinyal individual ── */
  console.log('\n5) Sinyal individual');
  ok('slot: 2+ entitas dikenali → 1', scoreSlots('beli apartemen di Surabaya') === 1);
  ok('slot: tanpa entitas → 0', scoreSlots('halo apa kabar') === 0);
  ok('lexical: kosakata properti → 1', scoreLexical('apa itu SHM?') === 1);
  ok('flow: AI baru bertanya → 1', scoreFlow('Kutisari', Q('Di area mana?')) === 1);
  ok('flow: tanpa riwayat → 0', scoreFlow('Kutisari', []) === 0);

  /* ── 6. Ambang dapat dikonfigurasi tapi bawaannya sesuai directive ── */
  console.log('\n6) Ambang');
  ok('bawaan 0.45 sesuai directive pemilik proyek', THRESHOLD === 0.45, String(THRESHOLD));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
