/**
 * agentSignatureIdentity.test.js
 *
 * Bug produksi (6 Agu 2026): summary ditandatangani "Nigel 期凡努" — NAMA
 * CUSTOMER — padahal agent pemilik nomor adalah "Leo Felix" (users.name).
 * Customer seolah menerima surat dari dirinya sendiri.
 *
 * Akar masalah BUKAN di data: controller sudah mengirim `agentName: agent.name`
 * dengan benar dan `resolvedAgentName` sudah terisi "Leo Felix". Masalahnya
 * prompt punya DUA nama dan hanya SATU yang diberi label eksplisit: blok
 * "Customer profile" berisi baris `Name: <customer>`, sedangkan nama agent hanya
 * muncul diam-diam di dalam template tanda tangan. Sebuah aturan prompt bahkan
 * secara keliru MENGARAHKAN model ke blok "Customer profile" untuk mencari nama
 * agent. Model memilih satu-satunya baris yang jelas berlabel "Name:".
 *
 * Fix: blok "🪪 IDENTITAS ANDA (AGENT)" eksplisit di prompt + blok customer
 * ditandai tegas sebagai LAWAN BICARA.
 */
const { buildWhatsappReplyPrompt } = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const mkPrompt = (over = {}) => buildWhatsappReplyPrompt(
  { agentName: 'Leo Felix', name: 'Nigel 期凡努', normalizedPhone: '628123456789', source: 'kirimi_leo_felix', ...over },
  [{ role: 'user', message: 'halo' }], 'halo', '', 'shared', {},
);

console.log('\n── Blok identitas agent hadir & berisi users.name ──');
{
  const p = mkPrompt();
  ok('blok "IDENTITAS ANDA (AGENT)" ada di prompt', /IDENTITAS ANDA \(AGENT\)/.test(p));
  ok('nama agent (users.name) tercantum eksplisit', /Nama agent \(users\.name\)\s*:\s*Leo Felix/.test(p));
  ok('nama aplikasi tercantum eksplisit', /Nama aplikasi \(APP_NAME\)\s*:/.test(p));
}

console.log('\n── Blok customer ditandai sebagai LAWAN BICARA, bukan sumber tanda tangan ──');
{
  const p = mkPrompt();
  ok('blok customer diberi peringatan "jangan dipakai sebagai tanda tangan"',
     /Customer profile \(LAWAN BICARA — jangan dipakai sebagai tanda tangan\)/.test(p));
  ok('baris nama customer diberi penanda "nama CUSTOMER"', /Name: Nigel 期凡努\s*←\s*nama CUSTOMER/.test(p));
}

console.log('\n── Aturan larangan tanda tangan pakai nama customer ──');
{
  const p = mkPrompt();
  ok('ada larangan eksplisit menandatangani dengan nama customer',
     /JANGAN menandatangani summary dengan NAMA CUSTOMER/.test(p));
  ok('aturan TIDAK lagi mengarahkan ke blok "Customer profile" untuk nama agent',
     !/Nama ASLI SUDAH ADA[^\n]*Customer profile/.test(p));
}

console.log('\n── Template tanda tangan terisi nama agent, bukan nama customer ──');
{
  const p = mkPrompt();
  const sigIdx = p.indexOf('Salam hangat,');
  const sigBlock = p.slice(sigIdx, sigIdx + 60);
  ok('baris setelah "Salam hangat," = nama agent', /Leo Felix/.test(sigBlock));
  ok('nama customer TIDAK muncul di blok tanda tangan', !/Nigel/.test(sigBlock));
}

console.log('\n── Nama agent berbeda tetap terbawa (bukan hardcode) ──');
{
  const p = mkPrompt({ agentName: 'Siti Rahma', name: 'Budi Santoso' });
  ok('agent lain → tanda tangan ikut berubah', /Nama agent \(users\.name\)\s*:\s*Siti Rahma/.test(p));
  ok('nama customer lain tidak bocor ke identitas agent',
     !/Nama agent \(users\.name\)\s*:\s*Budi Santoso/.test(p));
}

console.log('\n── Teks penutup summary sesuai permintaan (6 Agu 2026) ──');
{
  const p = mkPrompt();
  ok('pembuka summary = "Baik, saya sudah catat permintaan Anda"',
     /Baik, saya sudah catat permintaan Anda, sebagai berikut/.test(p));
  ok('kalimat "Saya akan segera menghubungi Anda…" DIHAPUS dari penutup non-katalog',
     !/Saya akan segera menghubungi Anda dengan rekomendasi properti/.test(p));
  ok('penutup tetap "Terima kasih sudah menghubungi saya."',
     /Terima kasih sudah menghubungi saya\./.test(p));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
