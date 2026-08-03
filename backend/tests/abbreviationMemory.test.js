/**
 * abbreviationMemory.test.js — M73 regression.
 *
 * Two independent causes of the 3 Aug 2026 infinite loop, both asserted here with
 * the real transcript:
 *
 *  (A) ANSWERS WRITTEN IN SMS-SPEAK WERE FORGOTTEN AFTER ONE TURN.
 *      whatsappAIService expands abbreviations on the CURRENT message only; the
 *      stored transcript stays raw on purpose (authentic for agent takeover).
 *      But extractQualificationState re-derives every slot from history each turn,
 *      so "Rencana tahun dpn" filled Q8 on turn N and was null again on turn N+1
 *      → the same question forever. Fix: normalize inside extractQualificationState
 *      so BOTH the LLM path and the Private Agent are covered.
 *
 *  (B) A LANDMARK ANSWER POISONED THE PROPERTY TYPE.
 *      "Saya mau dekat indomaret, warung, resto" (a Q6 anchor answer) set
 *      buildingType='store' because the Phase-1 type detector applied only
 *      stripCommercialUsePhrases, not the stripNearPhrases chain the other three
 *      call sites use. Type is first-match-wins, so a later "Saya mau beli rumah"
 *      could not correct it — a house hunter would be shown shops.
 *
 * Run: node tests/abbreviationMemory.test.js
 */

'use strict';

require('dotenv').config();
const { extractQualificationState, findNextQuestion } = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

console.log('── Group 1: SMS-speak answers survive the NEXT turn (A) ──');
{
  const base = [C('Saya mau beli rumah di Malang'), A('Rencananya masuk atau pindah bulan apa? 📅')];

  // Turn N — the answer is captured.
  const t1 = extractQualificationState(base, 'Rencana tahun dpn, Kak');
  ok('turn N: "Rencana tahun dpn" fills Q8', !!t1.moveInDate, `got ${t1.moveInDate}`);

  // Turn N+1 — the SAME message now sits in history RAW. It must still count.
  const next = base.concat([C('Rencana tahun dpn, Kak'), A('Nanti ditempati bersama siapa? 🛏️')]);
  const t2 = extractQualificationState(next, 'Sendirian, Kak');
  ok('turn N+1: Q8 still filled from RAW history', !!t2.moveInDate, `got ${t2.moveInDate}`);
  ok('turn N+1: Q8 value unchanged', t1.moveInDate === t2.moveInDate,
     `${t1.moveInDate} vs ${t2.moveInDate}`);

  // Other abbreviations must survive too — this class of bug is not date-specific.
  const abbrev = [
    ['Rencana masuk tahun dpn, Kak', 'moveInDate'],
    ['msk bln dpn', 'moveInDate'],
  ];
  for (const [msg, field] of abbrev) {
    const h = base.concat([C(msg), A('Nanti ditempati bersama siapa? 🛏️')]);
    const s = extractQualificationState(h, 'Sendirian, Kak');
    ok(`"${msg}" survives in history (${field})`, !!s[field], `got ${s[field]}`);
  }
}

console.log('\n── Group 2: a landmark answer must NOT set the property type (B) ──');
{
  // Standalone: no type stated yet — the anchor answer must not invent one.
  const s1 = extractQualificationState([], 'Saya mau dekat indomaret, warung, resto');
  ok('anchor answer alone does not set buildingType', !s1.buildingType, `got ${s1.buildingType}`);

  // And it must not block the real type stated afterwards.
  const h = [C('Saya mau dekat indomaret, warung, resto'), A('Mau sewa atau beli? Dan tipe propertinya apa?')];
  const s2 = extractQualificationState(h, 'Saya mau beli rumah');
  ok('later "beli rumah" resolves to house', s2.buildingType === 'house', `got ${s2.buildingType}`);
  ok('transaction resolves to sale', s2.transactionType === 'sale', `got ${s2.transactionType}`);
  ok('no spurious type-change reset', s2.typeChangedFromHistory !== true);

  // NEGATIVE CONTROL — a genuine shop search must still be detected as `store`.
  const shop = extractQualificationState([], 'Saya mau sewa toko di Malang');
  ok('CONTROL: real shop search still → store', shop.buildingType === 'store', `got ${shop.buildingType}`);
  const warung = extractQualificationState([], 'mau sewa warung');
  ok('CONTROL: "sewa warung" still → store', warung.buildingType === 'store', `got ${warung.buildingType}`);
}

console.log('\n── Group 3: the real transcript no longer loses state ──');
{
  // Replays the reported conversation; every slot must hold once answered.
  const hist = [];
  const push = (r, m) => hist.push(r === 'c' ? C(m) : A(m));

  push('c', 'Ditempati bersama keluarga, Kak');
  push('a', 'Mau sewa atau beli? Dan tipe propertinya apa? 🏠');
  push('c', 'Saya mau beli rumah');
  push('a', 'Sudah lihat berapa Rumah di Malang?');
  push('c', 'Belum pernah lihat');
  push('a', 'Di Malang ada house kisaran Rp 1.000.000 dan Rp 2.000.000. Kira-kira yang mana lebih sesuai? 💰');
  push('c', 'Saya cari yang harga 700-800juta');
  push('a', 'Rencananya masuk atau pindah bulan apa? 📅');
  push('c', 'Rencana tahun dpn, Kak');
  push('a', 'Ada yang pasti tidak cocok? 🚫');

  const s = extractQualificationState(hist, 'Mau akses jalan tdk macer dan akses jln yg lebar');
  ok('type = house (not store)', s.buildingType === 'house', `got ${s.buildingType}`);
  ok('transaction = sale', s.transactionType === 'sale', `got ${s.transactionType}`);
  ok('city = Malang', s.location === 'Malang', `got ${s.location}`);
  ok('budget kept', !!s.budget, `got ${s.budget}`);
  ok('move-in date kept (from "dpn")', !!s.moveInDate, `got ${s.moveInDate}`);

  const n = findNextQuestion(s);
  ok('NEXT is not a reset to Q1', n ? n.q !== 'Q1' : true, `got ${n ? n.q : 'summary'}`);
  ok('NEXT is not Q3 (budget already answered)', n ? n.q !== 'Q3' : true, `got ${n ? n.q : 'summary'}`);
  ok('NEXT is not Q8 (date already answered)', n ? n.q !== 'Q8' : true, `got ${n ? n.q : 'summary'}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);
