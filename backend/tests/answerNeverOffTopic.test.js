/**
 * answerNeverOffTopic.test.js — M65 regression.
 *
 * Reported bug: the AI asked "Rencananya masuk atau pindah bulan apa? 📅", the customer
 * answered "Rencana sih tahun depan", and the AI replied "Maaf, saya hanya bisa membantu
 * terkait pencarian properti." — twice in a row. A valid answer was classified as off-topic
 * purely because it contains no property keyword (which is normal for a short reply).
 *
 * Three layers must hold, and all three are asserted here:
 *   1. The WhatsApp gate accepts the answer (propertyKeywordFilter).
 *   2. The LLM prompt carries an explicit "an answer is never off-topic" exception to rule 0.
 *   3. The Private Agent has a structural guard so its own off-topic/clarification guards
 *      cannot fire when the previous AI message was a question.
 *
 * Run: node tests/answerNeverOffTopic.test.js
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { extractQualificationState, findNextQuestion, buildWhatsappReplyPrompt } =
  require('../services/aiPromptBuilderService');
const { lastAiMessageAsksQuestion, isPropertyContextContinuation, hasPropertyKeyword } =
  require('../utils/propertyKeywordFilter');
const { parseCustomerDate } = require('../utils/customerDateParser');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

// The exact conversation from the report.
const HIST = [
  C('Saya belum pernah lihat atau survei rumah di Surabaya'),
  C('Namun saya rencana mau beli rumah'),
  A('Baik, Kak! Di area atau kawasan mana di Surabaya yang Anda pertimbangkan? 📍'),
  C('Saya mempertimbangkan area di Sidotopo'),
  A('Oke! Nanti akan ditempati bersama siapa saja? 🛏️'),
  C('Saya rencana tinggal bersama istri'),
  A('Oke, Kak! Rencananya masuk atau pindah bulan apa? 📅'),
];

console.log('── Group 1: the gate accepts keyword-less answers ──');
{
  ok('last AI message detected as a question', lastAiMessageAsksQuestion(HIST) === true);

  const answers = [
    'Rencana sih tahun depan',
    'Rencana pindah tahun depan',
    'taun depan',
    'bulan depan',
    'Saya rencana tinggal bersama istri',
  ];
  for (const a of answers) {
    const accepted = hasPropertyKeyword(a) || isPropertyContextContinuation(a, HIST);
    ok(`"${a}" is not off-topic`, accepted === true);
  }
}

console.log('\n── Group 2: informal date spellings parse (taun/thn/bln) ──');
{
  const dates = [
    ['tahun depan', true], ['taun depan', true], ['thn depan', true],
    ['rencana sih taun depan', true], ['bulan depan', true], ['bln depan', true],
  ];
  for (const [input, shouldParse] of dates) {
    const r = parseCustomerDate(input);
    ok(`"${input}" parses`, !!(r && r.status === 'ok') === shouldParse,
       `got ${r ? r.status : 'null'}`);
  }
  // An explicit date in the same sentence must still win over the relative phrase.
  const explicit = parseCustomerDate('28 mei taun depan');
  ok('"28 mei taun depan" → 28 Mei (explicit date wins)',
     !!(explicit && /28 Mei/.test(explicit.formatted || '')), `got ${explicit && explicit.formatted}`);
}

console.log('\n── Group 3: state stays correct through the flow ──');
{
  const s = extractQualificationState(HIST, 'Rencana sih tahun depan');
  ok('transaction stays "sale" (customer said BELI)', s.transactionType === 'sale', `got ${s.transactionType}`);
  ok('district cleaned to the area name only', s.district === 'Sidotopo', `got ${JSON.stringify(s.district)}`);
  ok('move-in date captured', !!s.moveInDate, `got ${s.moveInDate}`);
  ok('household captured', !!s.household, `got ${s.household}`);
  const n = findNextQuestion(s);
  ok('NEXT is not a reset to Q1', n ? n.q !== 'Q1' : true, `got ${n ? n.q : 'summary'}`);
}

console.log('\n── Group 4: prompt + Private Agent carry the exception ──');
{
  const prompt = buildWhatsappReplyPrompt({
    userMessage: 'Rencana sih tahun depan', history: HIST,
    propertyContext: '', agentName: 'X', appName: 'Y',
  });
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
  ok('prompt rule 0 has the absolute exception', /PENGECUALIAN MUTLAK/.test(text));
  ok('prompt forbids two consecutive off-topic replies', /dua kali berturut-turut/.test(text));

  // The Private Agent must gate its off-topic/clarification guards on the same signal.
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'chatbotPrivateController.js'), 'utf8');
  ok('Private Agent imports lastAiMessageAsksQuestion', /lastAiMessageAsksQuestion/.test(src));
  const guarded = (src.match(/!aiJustAskedQuestion|!aiAskedLast/g) || []).length;
  ok('all 4 Private Agent guards are gated on it', guarded === 4, `found ${guarded}`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
process.exit(fail > 0 ? 1 : 0);
