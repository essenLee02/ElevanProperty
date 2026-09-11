/**
 * M187 (11 Sep 2026) — PROFIL 'platform': BACKEND HANYA MENYIAPKAN BAHAN.
 *
 * Transkrip produksi 11 Sep (agent Natasha, deepseek, skill house_pilot):
 * setiap pertanyaan setelah customer memilih unit adalah kalimat VERBATIM dari
 * skrip Q1–Q12 di buildWhatsappReplyPrompt, bukan dari skill. "Ada target
 * kapan proses belinya selesai?" ditanya tiga kali — termasuk setelah
 * "saya masih tanya-tanya dulu". Prompt user backend = 33.293 char, lebih
 * besar dari skill-nya sendiri.
 *
 * Kontrak:
 *  1. extraContext.guardProfile === 'platform' → prompt TANPA mesin interview
 *     (skrip Q, tabel 24 kombinasi, template brief, Summary Strict Rules,
 *     Task list, DIREKTIF FINAL, banner SUMMARY DIBLOKIR / PERTANYAAN
 *     BERIKUTNYA).
 *  2. Yang tetap ada: bahasa paksa, identitas agent/app, batas layanan agent,
 *     CATATAN SLOT sebagai fakta, katalog, fakta gerbang/RAG, riwayat, pesan.
 *  3. Tanpa guardProfile (web chatbot, Private Agent, tes lama) → jalur lama
 *     utuh, byte-identik dengan sebelumnya untuk input yang sama.
 *  4. whatsappAIService meneruskan guardProfile ke provider fallback.
 *  5. Facts block tidak memuat kata perintah (⛔/WAJIB/DILARANG/tanyakan).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const p = require('../services/aiPromptBuilderService');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${extra}` : ''}`); }
};
const C = (m) => ({ role: 'customer', message: m });
const A = (m) => ({ role: 'ai', message: m });

const hist = [
  C('Saya mau beli rumah di Sidoarjo, apakah ada?'),
  A('Di area atau kawasan mana di Sidoarjo yang Anda pertimbangkan?'),
  C('Saya mau di Puri Surya, Kak'),
  A('2. Puri Surya Jaya Tipe B Sidoarjo\n📍 Lokasi: SIDOARJO\n🗺️ Area: Puri Surya Jaya\n💰 Estimasi Harga: 1.27 miliar nego'),
  A('Ada yang menarik, Kak?'),
  C('Saya mau rumah di Puri Surya tipe B; Kak'),
  A('Ada target kapan proses belinya selesai?'),
];
const msg = 'Saya msh tanya"dlu; Kak';
const sess = { name: 'Cust', normalizedPhone: '628', source: 'whatsapp', agentName: 'AGENT X' };

console.log('\n[1] Platform prompt carries NO interview engine');
const lean = p.buildWhatsappReplyPrompt(sess, hist, msg, '', 'deepseek', { guardProfile: 'platform' });
const forbidden = [
  'PERTANYAAN BERIKUTNYA', 'DIREKTIF FINAL', 'SUMMARY SEDANG DIBLOKIR', 'SUMMARY DIBLOKIR',
  'Q_KPR', 'MANDATORY', 'Tanyakan cash/KPR', 'Task:', 'Brief format', '24 KOMBINASI',
  'Discovery Conversation Rules', 'Summary Strict Rules', 'ATURAN INTERPRETASI TANGGAL',
  'Ada target kapan proses beli', 'Nanti akan tinggal bersama siapa', 'Rencananya masuk bulan apa',
  'TANYAKAN SEKARANG', 'nomor Q terkecil', 'JANGAN tampilkan listing properti SELAMA',
];
// Riwayat fixture sendiri memuat kalimat skrip (itu yang dikirim AI di produksi) —
// yang diuji adalah bagian prompt di LUAR transkrip.
const leanNoHistory = lean.split('Riwayat percakapan')[0] + lean.split('Katalog nyata agent')[1];
for (const f of forbidden) ok(`no "${f}"`, !leanNoHistory.includes(f));
ok('platform prompt < 6000 chars without catalog', lean.length < 6000, `${lean.length}`);

console.log('\n[2] Platform prompt keeps the materials');
ok('forced language', /FORCED REPLY LANGUAGE/.test(lean));
ok('agent identity resolved', lean.includes('AGENT X'));
ok('facts block present', lean.includes('CATATAN SLOT'));
ok('facts: Beli / Rumah / Sidoarjo / Puri Surya', /Transaksi: Beli/.test(lean) && /Tipe properti: Rumah/.test(lean) && /Kota: Sidoarjo/.test(lean) && /Puri Surya/.test(lean));
ok('history included', lean.includes('Saya mau di Puri Surya, Kak'));
ok('latest message last', lean.trim().indexOf(msg) > lean.indexOf('CATATAN SLOT'));
const withCtx = p.buildWhatsappReplyPrompt(sess, hist, msg, 'KATALOG: 2 unit', 'deepseek',
  { guardProfile: 'platform', ragContext: 'RAG-BLOCK-XYZ', agentCoverageContext: 'COVERAGE-ABC' });
ok('RAG + coverage + catalog contexts pass through', withCtx.includes('RAG-BLOCK-XYZ') && withCtx.includes('COVERAGE-ABC') && withCtx.includes('KATALOG: 2 unit'));

console.log('\n[3] Facts block is memory, not commands');
const st = p.extractQualificationState(hist, msg);
const facts = p.buildQualificationFactsBlock(st);
ok('no ⛔ / WAJIB / DILARANG / "tanyakan" in facts', !/⛔|WAJIB|DILARANG|(?<![a-z])tanyakan/i.test(facts), facts.slice(0, 200));
ok('lists unstated slots in one line, not as ❓ rows', !facts.includes('❓') && /Belum disebut customer:/.test(facts));
const stCity = { ...st, cityChangedFromHistory: true, city: 'Gresik' };
ok('city change rendered as a fact', /MENGGANTI KOTA → Gresik/.test(p.buildQualificationFactsBlock(stCity)));

console.log('\n[4] Legacy path unchanged without guardProfile');
const legacyA = p.buildWhatsappReplyPrompt(sess, hist, msg, '', 'deepseek', {});
const legacyB = p.buildWhatsappReplyPrompt(sess, hist, msg, '', 'deepseek', { guardProfile: 'local' });
ok('legacy still carries the directive (local profile)', legacyA.includes('DIREKTIF FINAL') && legacyB.includes('DIREKTIF FINAL'));
ok('legacy identical for {} and {guardProfile:"local"}', legacyA === legacyB);
ok('platform prompt is a fraction of legacy', lean.length * 4 < legacyA.length, `${lean.length} vs ${legacyA.length}`);

console.log('\n[5] whatsappAIService forwards guardProfile');
const svc = fs.readFileSync(path.join(__dirname, '../services/whatsappAIService.js'), 'utf8');
ok('extraContext includes guardProfile at the provider call', /ragContext, guardProfile, gateFactsContext \}/.test(svc));

console.log('\n[6] Composing gates become FACTS in the platform profile (backend never writes the reply)');
ok('area disambiguation → fact when !backendMayCompose', /AREA AMBIGU DI KATALOG AGENT \(fakta\)/.test(svc));
ok('city offer declined → fact', /TAWARAN KOTA LAIN DITOLAK CUSTOMER \(fakta\)/.test(svc));
ok('city offer accepted → fact', /CUSTOMER MENERIMA TAWARAN KOTA LAIN \(fakta\)/.test(svc));
ok('city with zero stock → hard fact, not a backend reply', /KOTA TANPA STOK \(fakta keras\)/.test(svc) && /if \(cityHit && backendMayCompose\)/.test(svc));
ok('qualification gate still skipped for platform', /qualResponse && guardProfile === 'platform'/.test(svc));

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
process.exit(fail === 0 ? 0 : 1);
