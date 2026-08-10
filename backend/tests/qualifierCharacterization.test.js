/**
 * qualifierCharacterization.test.js
 *
 * CHARACTERIZATION test for ConversationQualifier.buildProfile() +
 * getNextQuestion() — the two largest, previously untested methods in
 * chatbotPrivateController.js (906 and 452 lines respectively).
 *
 * PURPOSE: this test does NOT assert what the behaviour *should* be. It records
 * what the behaviour *currently is* — quirks and bugs included — so that a
 * refactor can be proven not to change the live chat flow. If a scenario below
 * looks wrong, that is a finding to fix deliberately (and then re-record), not
 * a reason to "fix" this file.
 *
 * Run:      node tests/qualifierCharacterization.test.js
 * Re-record: UPDATE_SNAPSHOT=1 node tests/qualifierCharacterization.test.js
 *
 * The snapshot lives in tests/__snapshots__/qualifier.snapshot.json.
 */

'use strict';

/* ─── JAM DIBEKUKAN ───────────────────────────────────────────────────────────
 * Beberapa skenario memakai kata RELATIF ("besok bisa") yang dinormalisasi jadi
 * tanggal ABSOLUT ("11 Agustus 2026"). Nilainya otomatis berubah setiap hari,
 * sehingga snapshot GAGAL setiap kali dijalankan di tanggal berbeda — bukan
 * karena ada regresi. Ini sudah menghabiskan waktu diagnosis beberapa kali
 * (M75 dan M88 sama-sama harus mem-A/B dulu untuk membuktikannya artefak jam),
 * dan peringatannya di V7 §M75 menyarankan pembekuan ini.
 *
 * `Date` di-patch SEBELUM modul apa pun membaca waktu. new Date() tanpa argumen
 * dan Date.now() memakai tanggal acuan tetap; bentuk lain (new Date(x)) tidak
 * disentuh, sehingga parsing tanggal eksplisit tetap berjalan normal.
 */
const FROZEN_NOW = new Date('2026-08-10T09:00:00+07:00').getTime();
const _RealDate = Date;
// eslint-disable-next-line no-global-assign
Date = class extends _RealDate {
  constructor(...args) { return args.length ? new _RealDate(...args) : new _RealDate(FROZEN_NOW); }
  static now() { return FROZEN_NOW; }
};
Date.UTC = _RealDate.UTC;
Date.parse = _RealDate.parse;

const fs = require('fs');
const path = require('path');
const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');

const SNAP_DIR = path.join(__dirname, '__snapshots__');
const SNAP_FILE = path.join(SNAP_DIR, 'qualifier.snapshot.json');
const UPDATE = process.env.UPDATE_SNAPSHOT === '1';



/* ─── Transcript helpers ──────────────────────────────────────────────────── */
const u = (message) => ({ role: 'user', message });
const a = (message) => ({ role: 'ai', message });

/**
 * Scenarios deliberately cover the paths that carry known, hard-won bug fixes
 * (M35 session boundaries, Q2b loops, kos/kosongan false positive, floor-vs-budget,
 * anchor-vs-office-type, avoid/prefer pairing) plus the ordinary happy paths.
 */
const SCENARIOS = [
  {
    name: 'cold-start: type+tx only',
    history: [],
    message: 'mau sewa villa',
    filters: { buildingType: 'villa', transactionType: 'rent' },
  },
  {
    name: 'location answered',
    history: [u('mau sewa villa'), a('Di kota atau area mana yang Anda inginkan?')],
    message: 'di malang',
    filters: { buildingType: 'villa', transactionType: 'rent', location: 'Malang' },
  },
  {
    name: 'Q2b: belum pernah lihat (must not loop)',
    history: [
      u('mau sewa villa di malang'),
      a('Sudah lihat berapa properti di Malang? Apa yang membuat belum cocok?'),
    ],
    message: 'belum pernah lihat',
    filters: { buildingType: 'villa', transactionType: 'rent', location: 'Malang' },
  },
  {
    name: 'Q2b: compound answer (count + facility wish)',
    history: [
      u('mau sewa apartemen di surabaya'),
      a('Sudah lihat berapa properti di Surabaya? Apa yang membuat belum cocok?'),
    ],
    message: 'sudah 2 kali, saya mau cari yang ada fasilitas gym dan kolam renang',
    filters: { buildingType: 'apartment', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'budget: tier category',
    history: [u('mau sewa villa di malang'), a('Budget: terjangkau, menengah, atau eksklusif?')],
    message: 'menengah aja',
    filters: { buildingType: 'villa', transactionType: 'rent', location: 'Malang' },
  },
  {
    name: 'budget: numeric range (must not re-ask tier)',
    history: [u('mau sewa rumah di surabaya'), a('Budget: terjangkau, menengah, atau eksklusif?')],
    message: '2-4 juta per bulan',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'household: sendiri (infers 1 bedroom + Mandiri)',
    history: [u('mau sewa rumah di surabaya'), a('Nanti akan tinggal bersama siapa saja?')],
    message: 'saya tinggal sendiran aja',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'move-in date: explicit',
    history: [u('mau sewa rumah di surabaya'), a('Rencananya masuk atau pindah bulan apa?')],
    message: '7 juli 2026',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'red flags: informal negation batch',
    history: [u('mau sewa rumah di surabaya'), a('Ada yang pasti tidak cocok atau ingin dihindari?')],
    message: 'gk banjir, gk panas, saya mau tempat yang ramai',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'red flags: positive-framed wishes (avoid/prefer pairing)',
    history: [u('mau sewa rumah di surabaya'), a('Ada yang pasti tidak cocok atau ingin dihindari?')],
    message: 'tempat yang sejuk, akses jalan lancar dan tidak banjir',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'anchor: "deket kantor" must NOT flip type to office',
    history: [u('mau sewa rumah di surabaya'), a('Ada lokasi tertentu yang jadi patokan?')],
    message: 'deket kantor dan mall',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'anchor: comma list must be captured whole',
    history: [u('mau sewa rumah di surabaya'), a('Ada lokasi tertentu yang jadi patokan?')],
    message: 'deket indomaret, cafe dan ubaya',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'furnishing: "kosongan" must NOT flip type to kos',
    history: [u('mau sewa rumah di surabaya'), a('Furnished, semi-furnished, atau kosongan?')],
    message: 'kosongan saja',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'furnishing: plain "furnished" resolves to Full',
    history: [u('mau sewa rumah di surabaya'), a('Furnished, semi-furnished, atau kosongan?')],
    message: 'furnished',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'Q12 floor range must NOT be read as budget',
    history: [u('mau sewa apartemen di surabaya'), a('Ada preferensi tower atau lantai tertentu?')],
    message: 'hadap menghindari sinar matahari terbenam dan terbit.. lantai antara 12-15 aja',
    filters: { buildingType: 'apartment', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'lease duration: short stay in weeks',
    history: [u('mau sewa rumah di surabaya'), a('Rencananya sewa untuk berapa lama?')],
    message: '2 minggu',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'BELI: financing not yet given → Q_KPR expected',
    history: [u('mau beli rumah di surabaya'), a('Target kapan proses belinya?')],
    message: 'target 3 bulan lagi',
    filters: { buildingType: 'house', transactionType: 'sale', location: 'Surabaya' },
  },
  {
    name: 'BELI: KPR stated → Q_KPR-a expected',
    history: [u('mau beli rumah di surabaya'), a('Rencana pakai KPR atau cash?')],
    message: 'pakai kpr',
    filters: { buildingType: 'house', transactionType: 'sale', location: 'Surabaya' },
  },
  {
    name: 'BOUNDARY B: abandoned switch villa → hotel',
    history: [
      u('mau sewa villa di surabaya'),
      a('Rencananya masuk bulan apa?'),
      u('26 juni 2026'),
      a('Furnished atau kosongan?'),
      u('full furnished'),
    ],
    message: 'mau cari penyewaan hotel',
    filters: { buildingType: 'hotel', transactionType: 'rent' },
  },
  {
    name: 'BOUNDARY C: greeting restart with same type',
    history: [
      u('mau sewa apartemen di surabaya'),
      a('Budget berapa?'),
      u('2 juta'),
    ],
    message: 'Hi.. mau sewa apartemen di malang',
    filters: { buildingType: 'apartment', transactionType: 'rent', location: 'Malang' },
  },
  {
    name: 'BOUNDARY A: new search after summary sent',
    history: [
      u('mau sewa villa di surabaya'),
      a('Baik, semua sudah saya catat! 📝\n✓ Rencana: *Sewa*\n✓ Tipe: *Villa*\nSalam hangat,'),
    ],
    message: 'saya mau cari rumah di malang',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Malang' },
  },
  {
    name: 'lazy multi-slot single line',
    history: [],
    message: 'sewa villa kediri 3 kamar 1 minggu ac kolam renang',
    filters: { buildingType: 'villa', transactionType: 'rent', location: 'Kediri' },
  },
  {
    name: 'hotel booking frame',
    history: [u('booking hotel di surabaya'), a('Check-in tanggal berapa?')],
    message: '15 juli, 3 malam, 4 orang',
    filters: { buildingType: 'hotel', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'viewing schedule: day + hour',
    history: [
      u('mau sewa rumah di surabaya'),
      a('Kalau ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi?'),
      u('besok bisa'),
      a('Jam berapa?'),
    ],
    message: 'jam 1 siang',
    filters: { buildingType: 'house', transactionType: 'rent', location: 'Surabaya' },
  },
  {
    name: 'non-residential use-case: investasi (Q4 must be gated)',
    history: [u('mau beli rumah di surabaya'), a('Apa yang membuat cari rumah sekarang?')],
    message: 'buat investasi, mau disewakan lagi',
    filters: { buildingType: 'house', transactionType: 'sale', location: 'Surabaya' },
  },
  {
    // 31 Jul 2026 live-transcript bug: a customer DECLINING to widen the search
    // ("tidak ada", "tetap di Pakuwon") is just as much an answer as naming
    // another area — must not leave Q7 looking unanswered.
    name: 'alt-area: refusal counts as answered, not just naming another area',
    history: [
      u('mau sewa villa di surabaya area pakuwon'),
      a('Selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin dipertimbangkan?'),
    ],
    message: 'Tidak ada, Kak',
    filters: { buildingType: 'villa', transactionType: 'rent', location: 'Surabaya' },
  },
];

/* ─── Snapshot capture ────────────────────────────────────────────────────── */

/** Profile keys prefixed with `_` are raw derived text — noisy, not behaviour. */
function captureProfile(profile) {
  const out = {};
  for (const key of Object.keys(profile).sort()) {
    if (key.startsWith('_')) continue;
    const v = profile[key];
    // Record only meaningful values; false/''/[] is the default for most flags
    // and recording them all would bury real changes in noise.
    if (v === '' || v === false || v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[key] = v;
  }
  return out;
}

function capture(scenario) {
  const profile = CQ.buildProfile(scenario.history, scenario.message, scenario.filters);
  const record = { profile: captureProfile(profile) };

  for (const mode of ['summary', 'catalog']) {
    let q;
    try {
      q = CQ.getNextQuestion(profile, 'id', null, mode);
    } catch (err) {
      q = `__THREW__: ${err.message}`;
    }
    record[`nextQuestion_${mode}`] = q === null || q === undefined ? null : String(q);
  }
  return record;
}

/* ─── Runner ──────────────────────────────────────────────────────────────── */

const actual = {};
for (const s of SCENARIOS) actual[s.name] = capture(s);

if (UPDATE || !fs.existsSync(SNAP_FILE)) {
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  fs.writeFileSync(SNAP_FILE, JSON.stringify(actual, null, 2) + '\n', 'utf8');
  console.log(`📸 Snapshot recorded: ${path.relative(process.cwd(), SNAP_FILE)}`);
  console.log(`   ${SCENARIOS.length} scenarios captured.`);
  console.log('   Re-run without UPDATE_SNAPSHOT=1 to verify.');
  process.exit(0);
}

const expected = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'));
let pass = 0;
const diffs = [];

for (const s of SCENARIOS) {
  const exp = expected[s.name];
  const act = actual[s.name];
  if (exp === undefined) {
    diffs.push(`  ❌ ${s.name}\n       NEW scenario not in snapshot — re-record with UPDATE_SNAPSHOT=1`);
    continue;
  }
  const e = JSON.stringify(exp);
  const g = JSON.stringify(act);
  if (e === g) { pass++; console.log(`  ✅ ${s.name}`); continue; }

  const lines = [`  ❌ ${s.name}`];
  const keys = new Set([...Object.keys(exp.profile || {}), ...Object.keys(act.profile || {})]);
  for (const k of [...keys].sort()) {
    const ev = JSON.stringify((exp.profile || {})[k]);
    const av = JSON.stringify((act.profile || {})[k]);
    if (ev !== av) lines.push(`       profile.${k}: ${ev} → ${av}`);
  }
  for (const mode of ['summary', 'catalog']) {
    const key = `nextQuestion_${mode}`;
    if (JSON.stringify(exp[key]) !== JSON.stringify(act[key])) {
      lines.push(`       ${key}:`);
      lines.push(`         before: ${JSON.stringify(exp[key])}`);
      lines.push(`         after : ${JSON.stringify(act[key])}`);
    }
  }
  diffs.push(lines.join('\n'));
}

for (const d of diffs) console.log(d);

const fail = diffs.length;
console.log(`\nRESULT: ${pass}/${SCENARIOS.length} scenarios unchanged ${fail ? '❌ BEHAVIOUR CHANGED' : '✅'}`);
if (fail) {
  console.log('If the change was intentional, re-record: UPDATE_SNAPSHOT=1 node tests/qualifierCharacterization.test.js');
}
process.exit(fail ? 1 : 0);
