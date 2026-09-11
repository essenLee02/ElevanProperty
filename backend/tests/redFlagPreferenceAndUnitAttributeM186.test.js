/**
 * M186 (11 Sep 2026) — Red flag / preferensi & pertanyaan atribut unit.
 *
 * Kasus produksi 11 Sep: "Saya cari rumah yang tdk panas, tdk banjir, udaranya
 * segar, dan kawasan asri" dibalas katalog ulang; "kawasan asri" tercatat sebagai
 * AREA "Asri"; pembuka "rumah di Pakuwon" menjadikan Pakuwon sebagai KOTA; dan
 * "Apakah rmh tersebut banjir dan panas?" dianggap off-topic.
 *
 * Kontrak yang dikunci:
 *  1. redFlags tetap kalimat MENTAH (downstream #buildAvoidPreferPairs yang
 *     menurunkan antonim), klausa positif ikut terisi ke preferences.
 *  2. Kata sifat kawasan (asri/sepi/ramai/strategis/...) tidak pernah jadi district.
 *  3. Nama area yang tidak dikenal sebagai kota → district, city tetap kosong /
 *     kota asli.
 *  4. Pertanyaan atribut tentang unit yang dipilih lolos gate properti dan
 *     tidak dianggap curhat harian; curhat harian ("rumahku kebanjiran") tetap
 *     tidak lolos.
 *  5. Dokumen skill aktif memuat aturan M186 dan tidak terpotong oleh cap.
 */
require('dotenv').config();
const { extractQualificationState } = require('../services/aiPromptBuilderService');
const { hasPropertyKeyword, isPropertyContextContinuation } = require('../utils/propertyKeywordFilter');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

const card = (n, no, price) => `${n}. Pakuwon City House Sale Surabaya\n\n   📍 Lokasi: SURABAYA, JAWA TIMUR\n   🗺️ Area: Pakuwon City\n   🏡 Alamat: Jl. Pakuwon City No. ${no}, Surabaya\n   💰 Estimasi Harga: ${price}\n   🏠 Tipe: Rumah — Dijual`;

const hist = [
  C('Saya cari rumah di Pakuwon, Kak'),
  A('Untuk Rumah yang Anda cari — rencananya untuk sewa atau beli? 🏠'),
  C('Saya rencana beli rumah, Kak'),
  A('Ini 2 Rumah dijual di Pakuwon ya, Kak 😊'),
  A(card(1, 2, '641 juta')), A(card(2, 76, '668.8 juta')),
  A('Ada yang menarik, Kak?'),
];
const redflag = 'Saya cari rumah yang tdk panas, tdk banjir, udaranya segar, dan kawasan asri';

console.log('\n[1] Red-flag sentence: raw redFlags + preferences side-fill');
{
  const st = extractQualificationState(hist, redflag);
  // Ekstraktor menormalkan singkatan (tdk→tidak) — kalimat tetap utuh, bukan hanya klausa negasi.
  ok('redFlags holds the WHOLE sentence incl. positive clauses (downstream derives antonyms)',
    /tidak panas/.test(st.redFlags || '') && /tidak banjir/.test(st.redFlags || '') && /udaranya segar/.test(st.redFlags || '') && /kawasan asri/.test(st.redFlags || ''),
    JSON.stringify(st.redFlags));
  ok('preferences gets the positive clauses', /udaranya segar/i.test(st.preferences || '') && /asri/i.test(st.preferences || ''), JSON.stringify(st.preferences));
  ok('"kawasan asri" is NOT recorded as an area', !/^asri$/i.test(String(st.district || '')), JSON.stringify(st.district));
  ok('Pakuwon routed to district, not city', /pakuwon/i.test(st.district || '') , `district=${st.district}`);
  ok('city is Surabaya (from the cards) or empty — never "pakuwon"', !/pakuwon/i.test(String(st.city || '')), `city=${st.city}`);
  ok('type / transaction survive', st.buildingType && st.transactionType, `${st.buildingType}/${st.transactionType}`);
}

console.log('\n[2] Area-quality words never become a district');
for (const msg of ['mau yang kawasan sepi', 'daerah ramai boleh', 'area strategis dan asri']) {
  const st = extractQualificationState(hist, msg);
  ok(`"${msg}" → district stays Pakuwon`, /pakuwon/i.test(st.district || ''), `district=${st.district}`);
}

console.log('\n[3] Property-keyword gate: unit attribute questions pass, daily-life stays out');
const inTopic = [
  'Apakah rmh tersebut banjir dan panas?',
  'unit nomor 2 itu bising nggak?',
  'rumahnya aman dan sejuk kah?',
  'apakah daerahnya rawan banjir?',
];
for (const q of inTopic) ok(`IN: "${q}"`, hasPropertyKeyword(q) === true);
const outTopic = [
  'hari ini panas banget ya',
  'jalanan macet parah tadi',
  'kemarin hujan deras kebanjiran dimana-mana',
];
for (const q of outTopic) ok(`OUT: "${q}"`, hasPropertyKeyword(q) === false);

console.log('\n[4] Context continuation treats attribute question as property talk');
{
  const cont = isPropertyContextContinuation('Apakah rmh tersebut banjir dan panas?', [...hist, C(redflag), A('Siap, saya catat ya Kak. Ada yang menarik?'), C('Saya pilih nomer 2, Kak'), A('Oke, Pakuwon City House Sale Surabaya no 2 ya. Mau survei?')]);
  ok('attribute question about the chosen unit is a continuation', cont === true || (cont && cont.isContinuation !== false), JSON.stringify(cont));
}

console.log('\n[5] chat_gpt_responds docs carry the M186 rule and fit the cap');
{
  // ⚠️ Dibaca LANGSUNG dari folder chat_gpt_responds, bukan lewat AI_SKILL_CALL —
  // env produksi bisa menunjuk skill lain (11 Sep: house_pilot untuk uji coba),
  // dan tes ini menguji ISI dokumen, bukan skill mana yang sedang aktif.
  const fs = require('fs'); const path = require('path');
  const dir = path.join(__dirname, '..', 'asset', 'skills', 'chat_gpt_responds');
  const files = ['SKILL.md', ...fs.readdirSync(path.join(dir, 'docs')).filter((f) => f.endsWith('.md')).sort().map((f) => path.join('docs', f))];
  const raw = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const cap = 11000;
  ok(`loaded ${raw.length} chars ≤ cap ${cap}`, raw.length <= cap);
  ok('6 files (SKILL.md + docs 00-04)', files.length === 6, files.join(','));
  ok('Q5 rule: never re-send the catalog for a red flag', raw.includes('never re-send the catalog for it'));
  ok('Q5 rule: "kawasan asri" is a quality, not an area', raw.includes('"kawasan asri" is a quality, not an area'));
  ok('doc 03: unit-condition question handled from the card', raw.includes("They ask about that unit's condition"));
  ok('doc 04: red flags / area quality listed in scope', /red flag\/quality of a home or area/.test(raw));
  ok('pinned: all-positive Q5 answer still produces BOTH lines', raw.includes('all-positive Q5 answer still produces BOTH lines'));
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);
