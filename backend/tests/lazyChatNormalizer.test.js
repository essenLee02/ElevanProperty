/**
 * lazyChatNormalizer.test.js — id-realestate-lazy-chat-normalizer skill (28 Jul 2026).
 *
 * Run: node tests/lazyChatNormalizer.test.js
 */

'use strict';

const { expandAbbreviations, ABBR_DICT } = require('../utils/lazyChatNormalizer');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}

console.log('── Basic expansions ──');
{
  ok('"blm prnh lht rmh dkt psr" expands fully',
    expandAbbreviations('blm prnh lht rmh dkt psr') === 'belum pernah lihat rumah dekat pasar');
  ok('"gk bs bsk" expands', expandAbbreviations('gk bs bsk') === 'enggak bisa besok');
  ok('casing of the ORIGINAL token is ignored, expansion is lowercase',
    expandAbbreviations('BLM ada') === 'belum ada');
  ok('unmatched words pass through untouched',
    expandAbbreviations('mau sewa rumah di surabaya') === 'mau sewa rumah di surabaya');
}

console.log('\n── Token-boundary safety (never substring match) ──');
{
  ok('"ada" is NOT corrupted by any 2-letter token entry', expandAbbreviations('ada rumah') === 'ada rumah');
  ok('"organisasi" is NOT corrupted by "org"', expandAbbreviations('ikut organisasi kampus') === 'ikut organisasi kampus');
  ok('"orang" itself untouched (not in dict, real word)', expandAbbreviations('ada orang') === 'ada orang');
  ok('"samping" is NOT corrupted by "sm"/"sma"', expandAbbreviations('rumah samping pasar') === 'rumah samping pasar');
  ok('"pagi" (full word) untouched, not double-expanded', expandAbbreviations('selamat pagi') === 'selamat pagi');
}

console.log('\n── Trailing punctuation preserved ──');
{
  ok('"yg," → "yang,"', expandAbbreviations('rumah yg, gede') === 'rumah yang, gede');
  ok('"bsk?" → "besok?"', expandAbbreviations('bsk?') === 'besok?');
  ok('"udh!" → "sudah!"', expandAbbreviations('udh!') === 'sudah!');
}

console.log('\n── Explicitly excluded collisions (per skill doc safety rules) ──');
{
  ok('"no" is NEVER mapped (negation control word)', !Object.prototype.hasOwnProperty.call(ABBR_DICT, 'no'));
  ok('"ci" is NEVER mapped (too short)', !Object.prototype.hasOwnProperty.call(ABBR_DICT, 'ci'));
  ok('"standar" is NEVER mapped (collides with fasilitas standar / budget tier)',
    !Object.prototype.hasOwnProperty.call(ABBR_DICT, 'standar'));
  ok('"dekat SMA 5" — SMA (school landmark) NOT expanded to "sama"',
    expandAbbreviations('dekat SMA 5') === 'dekat SMA 5');
  ok('"dekat PG bunda" — PG (playgroup landmark) NOT expanded to "pagi"',
    expandAbbreviations('dekat PG bunda') === 'dekat PG bunda');
  ok('"tmn" (ambiguous teman/taman) left unexpanded, not guessed either way',
    expandAbbreviations('sama tmn dekat taman') === 'sama tmn dekat taman');
  ok('"tmn" itself is absent from the dictionary', !Object.prototype.hasOwnProperty.call(ABBR_DICT, 'tmn'));
  ok('"minggu" (real word, week vs Sunday ambiguity) is left to its own detector, not in dict',
    !Object.prototype.hasOwnProperty.call(ABBR_DICT, 'minggu'));
}

console.log('\n── Real-world lazy sentences (integration-style) ──');
{
  ok('"sy pgn cr rmh dkt skolah, bsk bs survei?"',
    expandAbbreviations('sy pgn cr rmh dkt skolah, bsk bs survei?')
      === 'saya ingin cari rumah dekat sekolah, besok bisa survei?');
  ok('"blm ada budget pasti, msh cr2 dl"',
    expandAbbreviations('blm ada budget pasti, msh cr2 dl') === 'belum ada budget pasti, masih cr2 dulu');
  ok('English contraction expansion: "i\'m not sure yet"',
    expandAbbreviations("i'm not sure yet") === 'i am not sure yet');
}

console.log('\n── Idempotency (expanding twice = expanding once) ──');
{
  const once = expandAbbreviations('blm prnh lht rmh dkt psr');
  const twice = expandAbbreviations(once);
  ok('expanding an already-expanded string is a no-op', once === twice);
}

console.log('\n── Edge cases ──');
{
  ok('empty string returns empty string', expandAbbreviations('') === '');
  ok('null/undefined pass through without throwing', expandAbbreviations(null) === null && expandAbbreviations(undefined) === undefined);
  ok('whitespace-only preserved', expandAbbreviations('   ') === '   ');
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed ${fail ? '❌ FAILURES' : '✅'}`);
process.exit(fail ? 1 : 0);
