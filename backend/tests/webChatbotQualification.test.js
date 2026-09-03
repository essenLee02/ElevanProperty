/**
 * webChatbotQualification.test.js
 *
 * Bug produksi (chatbot website, 12 Agu 2026): customer mengetik
 * "Saya mau booking rumah" dan LANGSUNG dibalas 8 listing acak lintas provinsi
 * (Sijunjung, Tebing Tinggi, Lebong, Serang, Kepi, Masohi, Bengkulu Tengah,
 * Simalungun) — padahal ia belum menyebut kota, budget, tanggal, apa pun.
 * Dijawab "Boleh" → 8 listing yang PERSIS SAMA diulang. Percakapan tidak pernah
 * maju.
 *
 * DUA sebab, keduanya di jalur web (WhatsApp/terminal message tidak kena):
 *
 *   1. `buildChatbotReplyPrompt()` adalah prompt TERPISAH yang jauh lebih tipis:
 *      tanpa QUALIFICATION STATE, tanpa DIREKTIF FINAL, tanpa gating summary —
 *      dan ditutup instruksi "Do not keep asking discovery questions before
 *      showing options…". Prompt itu secara harfiah MENYURUH model melewati
 *      kualifikasi.
 *   2. `chatbotController` menyuntikkan katalog pada SETIAP pesan, jadi selalu
 *      ada 8 listing siap salin di depan model.
 *
 * FIX: jalur web memakai pembangun prompt yang SAMA dengan WhatsApp, dan katalog
 * hanya dibangun setelah semua field wajib terisi.
 */
const {
  buildChatbotReplyPrompt, buildWhatsappReplyPrompt,
  extractQualificationState, listMissingMandatory,
} = require('../services/aiPromptBuilderService');

let pass = 0, total = 0;
const ok = (n, c) => { total++; if (c) { pass++; console.log(`  ✅ ${n}`); } else { console.log(`  ❌ ${n}`); } };

const u = m => ({ role: 'user', message: m });
const a = m => ({ role: 'assistant', message: m });
const WEB = { name: 'Nia', normalizedPhone: '628111', source: 'website_chatbot', location: '' };
const CATALOG = 'PROPERTY CATALOG CONTEXT:\n1. Sijunjung Waterfront House | rumah - sewa | 2.1 juta/tahun';

console.log('\n── Prompt web kini membawa mesin kualifikasi (dulu tidak sama sekali) ──');
{
  const p = buildChatbotReplyPrompt(WEB, [u('Saya mau booking rumah')], 'Saya mau booking rumah', CATALOG);
  ok('ada QUALIFICATION STATE',  /QUALIFICATION STATE/.test(p));
  ok('ada DIREKTIF FINAL',       /DIREKTIF FINAL/.test(p));
  ok('ada gating SUMMARY DIBLOKIR', /SUMMARY DIBLOKIR/.test(p));
  ok('instruksi lama "Do not keep asking discovery questions" SUDAH HILANG',
     !/Do not keep asking discovery questions/i.test(p));
}

console.log('\n── Pesan pembuka → BERTANYA, bukan membuang katalog ──');
{
  const p = buildChatbotReplyPrompt(WEB, [u('Saya mau booking rumah')], 'Saya mau booking rumah', CATALOG);
  const next = (p.match(/TANYAKAN SEKARANG → (\w+)/) || [])[1];
  ok('direktif menyuruh bertanya pertanyaan berikutnya', !!next);
  ok('pertanyaannya soal LOKASI (kota belum diketahui)', /Di \*kota\* mana|kota mana/i.test(p));
}

console.log('\n── Web dan WhatsApp menghasilkan prompt yang SAMA (satu perilaku) ──');
{
  const hist = [u('Saya mau booking rumah')];
  const web = buildChatbotReplyPrompt(WEB, hist, 'Saya mau booking rumah', CATALOG);
  const wa  = buildWhatsappReplyPrompt(WEB, hist, 'Saya mau booking rumah', CATALOG, 'shared', {});
  ok('prompt web === prompt WhatsApp untuk sesi yang sama', web === wa);
}

console.log('\n── Gate katalog: hanya dibangun setelah field wajib lengkap ──');
{
  // Persis kondisi transkrip: baru menyebut "booking rumah".
  const st1 = extractQualificationState([u('Saya mau booking rumah')], 'Saya mau booking rumah');
  const miss1 = listMissingMandatory(st1);
  ok('pesan pembuka → masih ada field wajib kosong (katalog ditahan)', miss1.length > 0);
  ok('kota termasuk yang kurang', miss1.some(m => /Lokasi KOTA/i.test(m)));

  // Alur lengkap → katalog boleh tampil.
  // ⚠️ 2 Sep 2026: area/kawasan kini termasuk 4 slot INTI (doc 04 §3.1), jadi
  // fixture "alur lengkap" harus menyebut area — bukan kota saja.
  const done = [
    u('mau sewa rumah di Surabaya, daerah Ngagel'),
    a('Di Surabaya ada rumah kisaran Rp 2.000.000 dan Rp 3.000.000. Mana lebih sesuai?'), u('2-3 juta'),
    a('Ada target kapan masuk?'), u('20 Agustus'),
    a('Ada yang pasti tidak cocok?'), u('tidak banjir'),
    a('Ada fasilitas yang wajib ada?'), u('standar saja'),
    a('Mau lihat unitnya tanggal berapa?'), u('25 Agustus'),
    a('Jam berapa yang paling pas?'),
  ];
  const st2 = extractQualificationState(done, 'jam 2 siang');
  ok('alur lengkap → tidak ada field wajib kosong (katalog boleh tampil)',
     listMissingMandatory(st2).length === 0);
}

console.log('\n── "Boleh" mid-flow tetap dibaca sebagai jawaban, bukan topik baru ──');
{
  const hist = [
    u('Saya mau booking rumah'),
    a('Di *kota* mana yang Anda pertimbangkan?'),
  ];
  const p = buildChatbotReplyPrompt(WEB, hist, 'Boleh', CATALOG);
  ok('ada larangan menganggap jawaban customer sebagai non-properti',
     /TIDAK PERNAH "non-properti"|jawaban atas pertanyaan kamu/i.test(p));
}

console.log('\n── Lokasi dari form widget mengisi Q2 (jangan tanya ulang kota) ──');
{
  // Widget web meminta name/phone/location di awal. Nilainya hanya ada di sesi,
  // sedangkan extractQualificationState() memindai TEKS PESAN saja — sehingga Q2
  // tetap ❓ dan bot menanyakan "di kota mana?" kepada orang yang baru saja
  // mengetiknya di form.
  const webWithLoc = { ...WEB, location: 'Surabaya' };
  const p = buildChatbotReplyPrompt(webWithLoc, [u('Saya mau booking rumah')], 'Saya mau booking rumah', '');
  ok('kota terisi dari session.location', /Kota\s+\[Q2\]:\s*Surabaya/i.test(p));
  ok('TIDAK menanyakan kota lagi', !/TANYAKAN SEKARANG → Q2:/.test(p));

  // WhatsApp sengaja TIDAK ikut — session.location di sana bisa sisa pencarian lama.
  const wa = { ...WEB, source: 'kirimi_leo_felix', location: 'Surabaya' };
  const pw = buildWhatsappReplyPrompt(wa, [u('Saya mau booking rumah')], 'Saya mau booking rumah', '', 'shared', {});
  ok('sesi WhatsApp TIDAK ikut di-seed (hindari hidupkan pencarian lama)',
     !/Kota\s+\[Q2\]:\s*Surabaya/i.test(pw));
}

console.log('\n── Private Agent (fallback) jalur web juga berkualifikasi ──');
{
  const { ConversationQualifier: CQ } = require('../controllers/chatbotPrivateController');
  const { extractPropertyFilters } = require('../services/propertyRecommendationService');

  const hist = [u('Saya mau booking rumah')];
  const filters = extractPropertyFilters('Saya mau booking rumah', hist);
  const profile = CQ.buildProfile(hist, 'Saya mau booking rumah', filters);
  const q = CQ.getNextQuestion(profile, 'id', null, 'catalog');
  ok('ada pertanyaan berikutnya → katalog DITAHAN', typeof q === 'string' && q.length > 0);
  ok('pertanyaannya bukan listing', !/juta\/tahun|Sijunjung/i.test(q || ''));
}

console.log(`\nRESULT: ${pass}/${total}`);
process.exit(pass === total ? 0 : 1);
