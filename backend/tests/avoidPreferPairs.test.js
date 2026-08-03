/**
 * avoidPreferPairs.test.js
 *
 * Mengunci pemisahan Hindari ↔ Prefer.
 *
 * Bug asal (produksi, 3 Agu 2026): customer menulis
 *   "Saya mau tempat yang jauh dari pemakaman, masjid, gereja, diskotik/club"
 * dan summary keluar sebagai:
 *   Hindari: "bau busuk", "tidak ramai"          ← DIKARANG, tak pernah disebut
 *   Prefer : "Jauh/hindari masjid"               ← ARAH TERBALIK
 * sementara pemakaman/gereja/diskotik hilang sama sekali.
 *
 * Penyebab: tidak ada satu pun kata kunci di PAIRS/AVOID_ONLY yang cocok dengan
 * penghindaran BERBASIS JARAK ("jauh dari X"), jadi ekstraktor mengembalikan
 * kosong dan LLM mengisi sendiri.
 */
const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');

let pass = 0, total = 0;
const ok = (name, cond) => { total++; if (cond) { pass++; console.log(`  ✅ ${name}`); } else { console.log(`  ❌ ${name}`); } };

const H = [{ role: 'assistant', message: 'Ada yang pasti tidak cocok atau ingin dihindari?' }];
const brief = (msg) => CQ.buildAgentBrief(
  { hasRedFlags: true, aiAskedRedFlags: true }, {}, H, msg
);
const avoidOf  = (msg) => String(brief(msg).redFlags?.value || '');
const preferOf = (msg) => String(brief(msg).preferences?.value || '');

console.log('\n── "jauh dari X" → HINDARI (tidak pernah Prefer) ──');
{
  const msg = 'Saya mau tempat yang jauh dari pemakaman, masjid, gereja, diskotik/club';
  const a = avoidOf(msg), p = preferOf(msg);
  for (const place of ['pemakaman', 'masjid', 'gereja', 'diskotik']) {
    ok(`"${place}" tercatat di Hindari`, a.toLowerCase().includes(place));
  }
  ok('masjid TIDAK bocor ke Prefer (arah tidak terbalik)', !p.toLowerCase().includes('masjid'));
  ok('"diskotik/club" utuh, tidak dipecah di garis miring', /diskotik\/club/i.test(a));
  // Item yang customer TIDAK PERNAH sebut tidak boleh muncul.
  for (const ghost of ['bau', 'busuk', 'sampah', 'tidak ramai']) {
    ok(`tidak mengarang "${ghost}"`, !a.toLowerCase().includes(ghost));
  }
}

console.log('\n── Hindari memuat bentuk NEGATIF, Prefer bentuk POSITIF ──');
{
  const msg = 'Tempat yang sejuk, akses jalan lancar, tidak banjir';
  const a = avoidOf(msg), p = preferOf(msg);
  ok('Hindari: "Tempat panas" (bukan "Tempat yang sejuk")', /tempat panas/i.test(a));
  ok('Hindari: "Jalan macet"',                              /jalan macet/i.test(a));
  ok('Hindari tidak memuat frasa positif "yang sejuk"',     !/yang sejuk/i.test(a));
  ok('Prefer: "Tempat yang sejuk"',                         /tempat yang sejuk/i.test(p));
  ok('Prefer: "Akses jalan lancar"',                        /akses jalan lancar/i.test(p));
  ok('larangan eksplisit tetap masuk Hindari',              /banjir/i.test(a));
}

console.log('\n── Dedup lintas-mekanisme ──');
{
  const a = avoidOf('Hindari dekat rel kereta dan tempat pembuangan sampah');
  const relCount = (a.match(/rel kereta/gi) || []).length;
  ok('“rel kereta” hanya sekali (tidak dobel dgn AVOID_ONLY)', relCount === 1);
  ok('“pembuangan sampah” tertangkap', /pembuangan sampah/i.test(a));
}

console.log('\n── Campuran positif + penghindaran jarak ──');
{
  const msg = 'Saya mau yang strategis, aman, jauh dari pabrik';
  const a = avoidOf(msg), p = preferOf(msg);
  ok('Prefer: strategis',              /strategis/i.test(p));
  ok('Prefer: lingkungan aman',        /aman/i.test(p));
  ok('Hindari: jauh dari pabrik',      /pabrik/i.test(a));
  ok('“strategis” tidak bocor ke Hindari', !/strategis/i.test(a));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
