/* ───────────────────────────────────────────────────────────────────────────
 * Regression: paraphrased-question re-ask loop (live transcript, 31 Jul 2026)
 *
 * The LLM paraphrases each question every time it asks. Detectors pinned to one
 * fixed wording never matched the paraphrase, so the slot stayed null, so the
 * question was asked again — self-reinforcing. The customer declined "area lain"
 * FIVE times and got asked FIVE times, and got angry.
 *
 * Two rules under test:
 *   1. A REFUSAL is an answer. Declining is answering.
 *   2. Detection must survive paraphrasing (semantic core, not exact wording).
 * ─────────────────────────────────────────────────────────────────────────── */
const { extractQualificationState } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else      { fail++; console.log(`  ❌ ${name}`); }
};

const u = (message) => ({ role: 'user',      message });
const a = (message) => ({ role: 'assistant', message });

/* ── The five real Q7 paraphrases the LLM produced in one conversation ────── */
const Q7_PARAPHRASES = [
  'Nah, selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin dipertimbangkan? 🗺️',
  'Nah, kalau begitu — selain area Pakuwon, apakah masih ada area lain di Surabaya yang ingin dipertimbangkan? 🗺️',
  'Selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin dipertimbangkan? 🗺️',
  'Nah, sebelum saya lanjutkan — selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin Kakak pertimbangkan? 🗺️',
  'Selain lokasi *Surabaya*, apakah Anda mau pilihan lokasi lainnya? 🗺️',
];

/* ── Every way this customer said "no" ───────────────────────────────────── */
const REFUSALS = [
  'Tidak ada, Kak',
  'Enggak ada, Kak',
  'Saya tetap mau di Pakuwon',
  'Enggak ada, Kak. Tetap di Pakuwon',
  'Di pakuwon saja',
];

console.log('\n── Q7: every paraphrase × every refusal must register as ANSWERED ──');
for (const q of Q7_PARAPHRASES) {
  for (const r of REFUSALS) {
    const st = extractQualificationState(
      [u('mau sewa villa di surabaya area pakuwon'), a(q)], r
    );
    check(`"${q.slice(0, 34)}…" + "${r}"`, !!st.alternativeAreas);
  }
}

console.log('\n── Q10: paraphrased duration questions must register ──');
const Q10_CASES = [
  ['Omong-omong, rencananya liburan di villa tersebut untuk berapa lama, Kak? ⏱️', 'Untuk 5 hari'],
  ['Nah, untuk liburan 5 hari, rencana sewa villa-nya untuk berapa lama, Kak? ⏱️', 'Saya booking selama 5 hari juga, Kak'],
  ['Nah, kalau begitu — untuk sewa villa-nya, rencananya berapa lama, Kak? ⏱️', '5 hari'],
  ['Rencananya menginap berapa lama? ⏱️', '3 malam'],
];
for (const [q, ans] of Q10_CASES) {
  const st = extractQualificationState(
    [u('mau sewa villa di surabaya'), a(q)], ans
  );
  check(`"${q.slice(0, 40)}…" → "${ans}"`, !!st.leaseDuration);
}

console.log('\n── Guard: unrelated AI text must NOT set these slots ──');
const NEGATIVE_CASES = [
  ['Di area atau kawasan mana di Surabaya yang Anda pertimbangkan?', 'Pakuwon', 'alternativeAreas',
   'Q2c "which area" is NOT Q7 "any OTHER area"'],
  ['Berapa budget yang Anda inginkan?', '5 juta', 'alternativeAreas', 'budget question'],
  ['Nanti akan menginap berapa orang, Kak?', '6 orang', 'leaseDuration', 'headcount is not duration'],
  ['Rencananya masuk atau pindah bulan apa? 📅', 'Agustus', 'leaseDuration', 'move-in date is not duration'],
];
for (const [q, ans, slot, why] of NEGATIVE_CASES) {
  const st = extractQualificationState(
    [u('mau sewa villa di surabaya'), a(q)], ans
  );
  check(`${slot} stays null — ${why}`, !st[slot]);
}

console.log('\n── Q7 normalization: refusal → positive intent; real areas kept verbatim ──');
const Q7_ASK = 'Nah, selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin dipertimbangkan? 🗺️';
const q7val = (ans) => extractQualificationState(
  [u('mau sewa villa di surabaya area pakuwon'), a(Q7_ASK)], ans
).alternativeAreas;

for (const r of REFUSALS) {
  const v = q7val(r);
  check(`refusal "${r}" → normalized, no bare "tidak ada"`,
        /fokus|tidak ada area alternatif/i.test(v) && !/^(tidak|enggak|di pakuwon saja)/i.test(v));
}
// A genuine alternative must survive untouched — normalization must not eat real data.
const REAL_ALTS = ['Bisa juga di Darmo', 'Gubeng atau Rungkut boleh', 'Darmo, Kak'];
for (const r of REAL_ALTS) {
  check(`real alternative "${r}" kept verbatim`, q7val(r) === r);
}

console.log('\n── Full live transcript: Q7 answered at first refusal, stays answered ──');
const transcript = [
  u('Hi... Mau booking villa di Surabaya'),
  a('Kisaran harga yang Anda inginkan berapa?'),
  u('Saya mau sewa villa dgn badget 2-2.6 juta/minggu. Karena saya mau liburan selama 1 minggu di Surabaya'),
  a('Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍'),
  u('Saya mau area Pakuwon'),
  a('Nah, Kak — sudah lihat berapa Villa di Surabaya?'),
  u('Saya cari villa yg nyaman, strategis..'),
  a('Rencananya masuk atau pindah bulan apa? 📅'),
  u('Rencana checkin 2 minggu lagi, Kak'),
  a('Nanti akan menginap berapa orang, Kak?'),
  u('Saya bersama 5 orang tmn krj saya'),
  a('Ada yang pasti tidak cocok atau ingin dihindari untuk villa-nya?'),
  u('Tdk banjir, akses jalan lancar dan Tempatnya ramai'),
  a('Nah, selain area Pakuwon di Surabaya, apakah masih ada area lain yang ingin dipertimbangkan? 🗺️'),
];
const stAfterFirstRefusal = extractQualificationState(transcript, 'Tidak ada, Kak');
check('Q7 registered as answered right after the FIRST refusal',
      !!stAfterFirstRefusal.alternativeAreas);

const total = pass + fail;
console.log(`\nRESULT: ${pass}/${total}`);
if (fail > 0) process.exitCode = 1;
