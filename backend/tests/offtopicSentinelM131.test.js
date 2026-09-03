/**
 * offtopicSentinelM131.test.js — regresi M131.
 *
 * Owner directive (23 Agu 2026): saat AI_PRIMARY_PROVIDER bukan 'private',
 * platform API (bukan backend) yang punya wewenang akhir memutuskan sebuah
 * pesan customer di luar topik dan tidak perlu dibalas sama sekali. Model
 * menyinyalkan ini dengan membalas PERSIS token `[[OFFTOPIC_SILENT]]` — tidak
 * ada teks lain. Backend mendeteksi token itu (utils/offTopicSentinel.js) dan
 * tetap diam: tidak menyimpan balasan sebagai pesan AI, tidak mengirim apa
 * pun ke WhatsApp. Fixture ini membuktikan:
 *   1. isSilentSentinel() cocok HANYA bila token itu satu-satunya isi balasan
 *      (exact-match, bukan substring) — sesuai instruksi skill doc.
 *   2. whatsappAIService.js mendeteksi sentinel di KEDUA jalur platform API
 *      (provider-fallback utama & fallback eksternal), SEBELUM guardReplyIdentity
 *      memprosesnya, dan wrapper generateWhatsAppAIReply() tidak memproses
 *      lebih lanjut hasil yang silent (gerbang tanya-nama dilewati).
 *   3. Ketiga controller WhatsApp (Kirimi/Fonnte/TimelinesAI, termasuk jalur
 *      Fonnte Chaining) memeriksa aiResult.silent SEBELUM menyimpan balasan
 *      ke ChatMessage / mengirim ke customer.
 *   4. Ketiga skill doc (claude_responds, chat_gpt_responds,
 *      elevan-property-assistant — chat_gpt_responds SEKARANG ikut disinkron,
 *      beda dari M129/M130 yang sengaja melewatkannya) memuat §3c: daftar 83
 *      kategori bernomor + protokol token diam.
 *
 * Run: node tests/offtopicSentinelM131.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
const ok = (n, c, extra = '') => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); } };

const { OFFTOPIC_SILENT_SENTINEL, isSilentSentinel } = require('../utils/offTopicSentinel');

console.log('\n=== 1. isSilentSentinel() — exact-match, bukan substring ===');
ok('token murni terdeteksi', isSilentSentinel(OFFTOPIC_SILENT_SENTINEL) === true);
ok('token + spasi di sekeliling tetap terdeteksi (trim)', isSilentSentinel(`  ${OFFTOPIC_SILENT_SENTINEL}  \n`) === true);
ok('token diselipkan di tengah kalimat lain TIDAK terdeteksi',
  isSilentSentinel(`Baik, ${OFFTOPIC_SILENT_SENTINEL} terima kasih`) === false);
ok('balasan normal tidak terdeteksi', isSilentSentinel('Maaf, saya hanya bisa membantu terkait properti.') === false);
ok('null/undefined/empty aman (false, bukan error)',
  isSilentSentinel(null) === false && isSilentSentinel(undefined) === false && isSilentSentinel('') === false);

console.log('\n=== 2. whatsappAIService.js — wiring sentinel di kedua jalur platform API ===');
const waSrc = fs.readFileSync(path.join(__dirname, '..', 'services', 'whatsappAIService.js'), 'utf8');

ok('mengimpor isSilentSentinel dari utils/offTopicSentinel', waSrc.includes("require('../utils/offTopicSentinel')"));

const primaryIdx  = waSrc.indexOf('generateWhatsappReplyWithProviderFallback(');
const primaryGuardIdx = waSrc.indexOf('isSilentSentinel(result.reply)');
const primaryGuardedIdx = waSrc.indexOf('const guarded = guardReplyIdentity(result.reply');
ok('jalur provider-fallback utama: cek sentinel ADA', primaryGuardIdx > -1);
ok('jalur provider-fallback utama: cek sentinel SEBELUM guardReplyIdentity (urutan benar)',
  primaryGuardIdx > -1 && primaryGuardedIdx > -1 && primaryGuardIdx < primaryGuardedIdx && primaryIdx < primaryGuardIdx);

const extIdx        = waSrc.indexOf('generateWhatsappExternalAIFallback(');
const extGuardIdx   = waSrc.indexOf('isSilentSentinel(aiResult.reply)');
const extGuardedIdx = waSrc.indexOf('const guardedExt = guardReplyIdentity(aiResult.reply');
ok('jalur fallback eksternal: cek sentinel ADA', extGuardIdx > -1);
ok('jalur fallback eksternal: cek sentinel SEBELUM guardReplyIdentity (urutan benar)',
  extGuardIdx > -1 && extGuardedIdx > -1 && extGuardIdx < extGuardedIdx && extIdx < extGuardIdx);

ok('kedua jalur mengembalikan silent:true saat sentinel terdeteksi',
  (waSrc.match(/silent:\s*true/g) || []).length >= 2);

ok('wrapper generateWhatsAppAIReply() berhenti lebih awal saat result.silent (tidak proses gerbang tanya-nama)',
  /if \(result\.silent\) return result;/.test(waSrc));

console.log('\n=== 3. Controllers — skip simpan & kirim saat aiResult.silent ===');
const controllerChecks = [
  ['kirimiChatController.js', 'aiResult.silent'],
  ['fonnteChatController.js', 'aiResult.silent'],
  ['timelinesAIChatController.js', 'aiResult.silent'],
];
controllerChecks.forEach(([file, needle]) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', file), 'utf8');
  const guardIdx = src.indexOf(`if (${needle})`);
  const saveIdx  = src.indexOf("role          : 'ai',");
  ok(`${file}: memeriksa ${needle} SEBELUM menyimpan balasan AI ke ChatMessage`,
    guardIdx > -1 && saveIdx > -1 && guardIdx < saveIdx);
});

// Fonnte Chaining (jalur kedua, balasan sinkron lewat HTTP response, bukan send terpisah)
const fonnteSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'fonnteChatController.js'), 'utf8');
ok('fonnteChatController.js (jalur Chaining): memeriksa result.silent sebelum aiReply = result.reply',
  (() => {
    const guardIdx = fonnteSrc.indexOf('if (result.silent)');
    const assignIdx = fonnteSrc.indexOf('aiReply = result.reply;');
    return guardIdx > -1 && assignIdx > -1 && guardIdx < assignIdx;
  })());

console.log('\n=== 4. Skill docs — §3c (83 kategori + protokol token diam) di SEMUA 3 folder ===');
const SKILLS_ROOT = path.join(__dirname, '..', '..', 'skills');
const FOLDERS = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

FOLDERS.forEach((f) => {
  const doc = fs.readFileSync(path.join(SKILLS_ROOT, f, 'docs', '08-offtopic-and-escalation.md'), 'utf8');
  ok(`${f}: memuat §3c`, doc.includes('3c. Full Category Reference & Silence Protocol'));
  ok(`${f}: memuat rujukan M131`, doc.includes('M131'));
  ok(`${f}: memuat token sentinel persis`, doc.includes('[[OFFTOPIC_SILENT]]'));
  ok(`${f}: memuat semua 83 nomor kategori (cek #1, #43, #65, #83)`,
    /\b1\. Movie, Film\b/.test(doc) && /\b43\. Candi, Candi\b/.test(doc) &&
    /\b65\. Gods, Dewa, Tuhan, Allah\b/.test(doc) && /\b83\. Furnitur/.test(doc));
  ok(`${f}: menegaskan §1 (jawaban atas pertanyaan sendiri tetap menang) tetap berlaku`,
    doc.includes('§1 always applies first') || doc.includes("§1's rule always wins"));
});

// chat_gpt_responds sekarang HARUS ikut punya §3a/§3b juga (disinkronkan ulang sesi ini,
// beda dari keputusan M129/M130 yang sengaja melewatkannya).
const chatGptDoc = fs.readFileSync(path.join(SKILLS_ROOT, 'chat_gpt_responds', 'docs', '08-offtopic-and-escalation.md'), 'utf8');
ok('chat_gpt_responds: disinkron ulang, sekarang ikut memuat §3a (M129)', chatGptDoc.includes('3a. Property legal/financing terminology'));
ok('chat_gpt_responds: disinkron ulang, sekarang ikut memuat §3b (M130)', chatGptDoc.includes('3b. Distance/travel-time questions'));

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
