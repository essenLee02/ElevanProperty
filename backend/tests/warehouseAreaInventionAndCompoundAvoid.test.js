/**
 * warehouseAreaInventionAndCompoundAvoid.test.js
 *
 * Mengunci DUA bug produksi nyata dari SATU transkrip (customer beli gudang
 * di Jakarta, 18 Agu 2026, jalur LLM/ChatGPT):
 *
 *  M92a — AREA DIKARANG DARI CONTOH DOKUMEN SENDIRI.
 *    Customer tidak pernah menyebut nama area apa pun (hanya "Jakarta yang
 *    bagian barat saja" sebagai jawaban Q7 area-alternatif, BUKAN Q2c).
 *    Summary yang terkirim tetap menampilkan "✓ Area: Sidotopo" — kata itu
 *    HANYA ada di skill doc sendiri (04-qualification-flow.md) sebagai
 *    ilustrasi "Customer: 'Area Sidotopo' → ✓ Area: Sidotopo". Model menyalin
 *    contoh dari instruksinya sendiri, bukan dari pesan customer manapun.
 *    Kelas yang sama dengan M84 ("Ciputra"), sumber priming BERBEDA (kali ini
 *    dari dalam skill doc, bukan dari Real-Estate/*.md).
 *
 *  M92b — KALIMAT MAJEMUK Hindari/Prefer HANYA SEBAGIAN TERSALIN.
 *    Satu pesan: "saya cari akses jalan yang lebar, karena saya punya truk
 *    besar. Pastikan akses jalannya bagus, tidak retak-retak. Tidak banjir
 *    dan dekat dengan jalan tol." — TIGA klausa relevan-penghindaran plus
 *    satu anchor. State server SUDAH memuat kalimat penuh (dibuktikan di
 *    bawah), tapi ringkasan yang terkirim ke customer hanya mencetak
 *    "✓ Hindari: Tidak mau banjir" — dua klausa lain (jalan retak, jalan
 *    sempit/lebar) dan baris Prefer hilang sama sekali.
 *
 * Verifikasi mengikuti prinsip proyek: reproduksi state SEBELUM menyimpulkan
 * kelas bug (dump state block dulu — lihat §PRINSIP DEBUG). Untuk M92a, state
 * sudah dibuktikan BERSIH (district null) — jadi obatnya CONTOH KONKRET di
 * skill doc + DIREKTIF FINAL, bukan ekstraktor baru (tidak ada apa pun untuk
 * diekstrak, sesuai kelas M83/M91).
 */

const path = require('path');
const fs = require('fs');
const {
  extractQualificationState,
  buildQualificationStateBlock,
  buildFinalDirective
} = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = (m) => ({ role: 'user', message: m });
const a = (m) => ({ role: 'assistant', message: m });

// ─── Transkrip PERSIS (anonimkan nama, alur & kata-kata identik) ─────────────
const history = [
  u('Saya mau beli gudang'),
  a('Baik! Mau beli Gudang. Di kota mana yang Anda inginkan? Dan kisaran harga yang Anda siapkan?'),
  u('Mau beli di Jakarta'),
  a('Hampir lengkap! Untuk beli Gudang di Jakarta — Kisaran harga yang Anda inginkan berapa?'),
  u('Cari 800-2 miliar'),
  a('Sudah lihat berapa Gudang di Jakarta? Apa yang membuat belum cocok dari yang sudah dilihat?'),
  u('Belum pernah, namun saya cari akses jalan yang lebar, karena saya punya truk besar. Pastikan akses jalannya bagus, tidak retak-retak. Tidak banjir dan dekat dengan jalan tol'),
  a('Ada target kapan proses belinya mau selesai?'),
  u('Desember ini, Kak'),
  a('Untuk pembiayaan, rencananya cash, KPR komersial, atau kombinasi?'),
  u('KPR aja, Kak'),
  a('Di Jakarta, apakah ada area lain yang masih oke buat Kak pertimbangkan?'),
  u('Jakarta yang bagian barat saja'),
  a('Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain?'),
  u('Boleh, Kak.'),
  u('Besok jam 4 sore'),
  a('Tinggi langit-langit dibutuhkan berapa meter?'),
  u('20 meter - 40 meter'),
  a('Perlu pengecekan legalitas zona industri/pergudangan sebelum deal?'),
  u('Iya, Kak')
];

console.log('\n[M92a] Area TIDAK boleh dikarang dari contoh skill doc');

const state = extractQualificationState(history, 'Iya, Kak');

// ── Bukti akar masalah: state SUDAH bersih (bukan bug ekstraksi) ───────────
ok('KONTROL: customer tidak pernah menyebut nama area apa pun → district null',
  state.district === null || state.district === undefined || state.district === '');
ok('KONTROL: kota tetap Jakarta (bukan ikut ke-reset)', state.city === 'Jakarta');
ok('KONTROL: jawaban Q7 ("Jakarta bagian barat") TIDAK bocor jadi district',
  state.district !== 'Jakarta bagian barat' && state.district !== 'Barat');

const stateBlock = buildQualificationStateBlock(state);
ok('state block menandai Area sebagai ❓ (belum dijawab)',
  /Area\/Kecamatan\s*\[Q2c\]:\s*BELUM DIJAWAB/.test(stateBlock) || /❓.*Area/.test(stateBlock));

const finalDirective = buildFinalDirective(state, { agentName: 'LEO FELIX', appName: 'Elevan Property' });

ok('DIREKTIF FINAL melarang menulis nama area saat district null',
  finalDirective.includes('AREA (Q2c) BELUM DIKETAHUI'));
ok('DIREKTIF FINAL secara EKSPLISIT menyebut "Sidotopo" sebagai token terlarang',
  finalDirective.includes('Sidotopo'));
ok('DIREKTIF FINAL juga melarang "Ciputra" (token M84 lama, tetap dijaga)',
  finalDirective.includes('Ciputra'));

// ── KONTROL NEGATIF: begitu customer BENAR-BENAR menyebut area, larangan hilang ──
const historyWithRealArea = [...history];
historyWithRealArea[historyWithRealArea.length - 1] = u('Iya Kak, sekalian area Kalideres');
const stateWithArea = extractQualificationState(
  [...history.slice(0, -1), u('Kalideres, Jakarta Barat')],
  'Kalideres, Jakarta Barat'
);
if (stateWithArea.district) {
  const directiveWithArea = buildFinalDirective(stateWithArea, { agentName: 'LEO FELIX', appName: 'Elevan Property' });
  ok('KONTROL NEGATIF: begitu district TERISI, larangan area-null tidak muncul lagi',
    !directiveWithArea.includes('AREA (Q2c) BELUM DIKETAHUI'));
} else {
  ok('KONTROL NEGATIF: begitu district TERISI, larangan area-null tidak muncul lagi', false);
}

// ── Bukti dokumentasi: peringatan anti-priming ada di KETIGA folder skill ──
console.log('\n[M92a] Dokumentasi disinkronkan ke ketiga folder skill');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const folders = ['claude_responds', 'chat_gpt_responds', 'elevan-property-assistant'];

folders.forEach((folder) => {
  const docPath = path.join(PROJECT_ROOT, 'skills', folder, 'docs', '04-qualification-flow.md');
  const text = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  ok(`${folder}/docs/04: memuat peringatan anti-priming "Sidotopo"`,
    text.includes('Sidotopo') && /(is|are) NOT customer data|BUKAN jawaban customer/i.test(text));
});

const claudeDoc = fs.readFileSync(path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '04-qualification-flow.md'), 'utf8');
const chatgptDoc = fs.readFileSync(path.join(PROJECT_ROOT, 'skills', 'chat_gpt_responds', 'docs', '04-qualification-flow.md'), 'utf8');
ok('claude_responds & chat_gpt_responds doc 04 BYTE-IDENTICAL (aturan wajib proyek)',
  claudeDoc === chatgptDoc);

// ── KONTROL NEGATIF: contoh SKILL.md standalone tidak lagi memakai "Sidotopo" ──
const standaloneSkillMd = fs.readFileSync(path.join(PROJECT_ROOT, 'skills', 'elevan-property-assistant', 'SKILL.md'), 'utf8');
ok('KONTROL NEGATIF: SKILL.md standalone TIDAK lagi memakai "Sidotopo" sebagai nilai contoh',
  !/✓ Area: Sidotopo/.test(standaloneSkillMd));

// ═══════════════════════════════════════════════════════════════════════════

console.log('\n[M92b] Kalimat majemuk Hindari/Prefer — state menyimpan SEMUA klausa');

ok('state Q5/red flags memuat klausa "tidak retak-retak"',
  String(state.avoidList || state.redFlags || '').includes('retak-retak'));
ok('state Q5/red flags memuat klausa "akses jalan yang lebar"',
  String(state.avoidList || state.redFlags || '').includes('akses jalan yang lebar'));
ok('state Q5/red flags memuat klausa "Tidak banjir"',
  String(state.avoidList || state.redFlags || '').includes('banjir') || String(state.avoidList || state.redFlags || '').includes('Banjir'));
ok('KONTROL: anchor "dekat jalan tol" masuk ke Q6, BUKAN ke Q5/Hindari',
  String(state.anchorPoint || '').toLowerCase().includes('jalan tol'));

console.log('\n[M92b] Dokumentasi memuat contoh dekomposisi 3-klausa (ketiga folder)');

folders.forEach((folder) => {
  const docPath = path.join(PROJECT_ROOT, 'skills', folder, 'docs', '04-qualification-flow.md');
  const text = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';
  ok(`${folder}/docs/04: memuat contoh dekomposisi kalimat majemuk (akses jalan lebar/truk)`,
    text.includes('truk besar') && text.includes('Jalan rusak/retak') && text.includes('Gang sempit'));
});

const claudeDoc2 = fs.readFileSync(path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '04-qualification-flow.md'), 'utf8');
const chatgptDoc2 = fs.readFileSync(path.join(PROJECT_ROOT, 'skills', 'chat_gpt_responds', 'docs', '04-qualification-flow.md'), 'utf8');
ok('claude_responds & chat_gpt_responds tetap BYTE-IDENTICAL setelah kedua fix',
  claudeDoc2 === chatgptDoc2);

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
