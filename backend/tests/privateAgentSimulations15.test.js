'use strict';
/**
 * privateAgentSimulations15.test.js — M193 (14 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * 15 SIMULASI PERCAKAPAN end-to-end lewat pipeline Private Agent yang ASLI
 * (generatePrivateTerminalMassege + katalog nyata agent NA40D8N007).
 *
 * Latar: Private Agent (chatbotPrivateController.js) melayani hampir seluruh
 * trafik produksi (DeepSeek 402). Enam kelas bug M188-M192 semuanya berasal
 * dari alur yang "ada di dokumen skill tapi tidak ada di kode deterministik".
 * Simulasi ini mengunci alur-alur itu sebagai perilaku yang bisa diuji:
 * lanjut chat setelah summary, ganti area, ganti kota, ngekos/kontrak,
 * sewa berdurasi, kota/area/tipe yang tidak ada di stok agent, pilih +
 * survei, tolak survei, keluhan harga, terima kasih vs penutup keras,
 * Gate C 10-12 percakapan.
 *
 * Yang diuji adalah INVARIAN perilaku (tidak kirim ulang katalog, ringkasan
 * hanya memuat yang ditanya & dijawab, tanggal absolut, dst), BUKAN kalimat
 * persis — kalimat boleh berubah, perilaku tidak.
 *
 * Butuh DB (katalog agent). Bila DB tidak terjangkau -> semua di-skip dengan
 * pesan jelas, TIDAK diam-diam lolos.
 *
 * Run: node tests/privateAgentSimulations15.test.js
 */
require('dotenv').config();

const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
const AGENT_NAME = 'NATASHA AUWLIANDY';
const VERBOSE = process.env.SIM_VERBOSE === '1';

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${String(detail).slice(0, 300)}` : ''}`); }
}

const isCard = (t) => /^\s*\d{1,2}\.\s+\*{1,2}[^*]+\*{1,2}/m.test(String(t || ''));
const isSummary = (t) => /[✓✔]\s*Rencana\s*:/i.test(String(t || ''));
const hasAbsDate = (t) => /\b\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+20\d\d\b/.test(String(t || ''));

async function runSim(title, customerTurns, generate) {
  console.log(`\n── ${title} ──`);
  const history = [];
  const replies = [];
  for (const msg of customerTurns) {
    const res = await generate({
      session: null, history, userMessage: msg, agentName: AGENT_NAME, agentUserId: AGENT,
      externalError: new Error('simulation'),
    });
    const reply = String(res && res.reply || '');
    replies.push({ msg, reply, provider: res && res.provider });
    history.push({ role: 'customer', message: msg });
    history.push({ role: 'ai', message: reply });
    if (VERBOSE) console.log(`  👤 ${msg}\n  🤖 ${reply.replace(/\n+/g, ' ⏎ ').slice(0, 260)}\n`);
  }
  return { history, replies, last: replies[replies.length - 1] };
}

async function main() {
  let generate;
  try {
    ({ generatePrivateTerminalMassege: generate } = require('../controllers/chatbotPrivateController'));
    const svc = require('../services/propertyRecommendationService');
    // Sama seperti server.js saat boot: tanpa cache ini detectLandmark() dan
    // qs.district diam-diam kosong -> "Alana Cemandi" di pesan pembuka tidak
    // terbaca sebagai area (ditemukan saat membangun simulasi ini).
    await svc.initFacilityCache();
    await svc.initCityCache();
    await svc.initLandmarkCache();
    const rows = await svc.getDbPropertiesForAgent(AGENT);
    if (!rows || !rows.length) throw new Error(`agent ${AGENT} punya 0 listing`);
  } catch (e) {
    console.log(`\n⚠️  DB/katalog tidak terjangkau (${e.message}) — 15 simulasi DI-SKIP, bukan lolos.`);
    console.log('\nRESULT: 0/0 (skipped)');
    process.exit(0);
  }

  /* 1 ── Lanjut chat SETELAH summary: dijawab, tidak re-interview, tidak kirim summary lagi */
  {
    const s = await runSim('1. Lanjut chat setelah summary', [
      'Mau beli rumah di Surabaya, area Mulyorejo',
      'Saya pilih no 1',
      'Cukup, itu saja Kak',
      'Kalau harganya bisa nego nggak?',
      'Makasih ya',
    ], generate);
    const summaries = s.replies.filter((r) => isSummary(r.reply)).length;
    ok('summary terkirim tepat SEKALI', summaries === 1, `summaries=${summaries}`);
    ok('pertanyaan nego setelah summary tetap DIJAWAB (bukan summary/katalog)', !isSummary(s.replies[3].reply) && !isCard(s.replies[3].reply) && /nego|agent/i.test(s.replies[3].reply), s.replies[3].reply);
    ok('"makasih" setelah summary -> tidak ada summary kedua', !isSummary(s.replies[4].reply), s.replies[4].reply);
  }

  /* 2 ── Ganti AREA di tengah alur: listing area baru, transaksi/tipe tidak ditanya ulang */
  {
    const s = await runSim('2. Ganti area (Kenjeran -> Simokerto), sewa rumah Surabaya', [
      'Mau sewa rumah di Surabaya, daerah Kenjeran',
      'Eh, ganti ke Simokerto saja Kak',
    ], generate);
    ok('area Kenjeran menghasilkan kartu', isCard(s.replies[0].reply), s.replies[0].reply);
    ok('ganti area -> kartu Simokerto (bukan tanya ulang sewa/beli atau tipe)', isCard(s.replies[1].reply) && /simokerto/i.test(s.replies[1].reply) && !/sewa atau beli|tipe properti apa/i.test(s.replies[1].reply), s.replies[1].reply);
  }

  /* 3 ── Ganti KOTA: patokan/listing kota baru, bukan reset ke Q1 */
  {
    const s = await runSim('3. Ganti kota (Surabaya -> Sidoarjo), beli rumah', [
      'Cari rumah dijual di Surabaya, Wiyung',
      'Kalau di Sidoarjo ada? Ganti ke Sidoarjo aja',
    ], generate);
    const r = s.replies[1].reply;
    ok('ganti kota TIDAK reset ke "sewa atau beli / tipe apa"', !/sewa atau beli|tipe properti apa|mau beli rumah\?/i.test(r), r);
    ok('balasan menyebut Sidoarjo (area nyata / patokan / kartu)', /sidoarjo|candramas|djuanda|cemandi|kwangsan/i.test(r), r);
  }

  /* 4 ── Ngekos: agent TIDAK punya kos -> jujur, tawarkan tipe nyata, tanpa kos karangan */
  {
    const s = await runSim('4. Ngekos - agent tidak punya kos', [
      'Kak, saya mau ngekos di Surabaya dekat kampus',
    ], generate);
    const r = s.replies[0].reply;
    ok('tidak mengarang kartu kos', !(isCard(r) && /kos/i.test(r)), r);
    ok('menyatakan belum ada / menawarkan tipe nyata (rumah/apartemen) atau bertanya area', /belum ada|tidak ada|rumah|apartemen|area|kawasan/i.test(r), r);
  }

  /* 5 ── Kontrak rumah dengan DURASI: Q10 tercatat di summary */
  {
    const s = await runSim('5. Kontrak rumah 2 tahun (durasi)', [
      'Saya mau kontrak rumah di Surabaya, Simokerto, buat 2 tahun',
      'Saya ambil no 1',
      'Rencana masuk bulan depan',
      'Cukup Kak, itu saja',
    ], generate);
    const sum = s.replies.find((r) => isSummary(r.reply));
    ok('summary terbentuk', Boolean(sum));
    ok('Durasi sewa 2 tahun tercatat', sum && /Durasi[^\n]*2\s*tahun/i.test(sum.reply), sum && sum.reply);
    ok('Masuk tercatat ABSOLUT (ditanya via pernyataan "rencana masuk")', sum && /Masuk:\s*\*[^*]*\d{1,2}\s+\w+\s+20\d\d/.test(sum.reply), sum && sum.reply);
  }

  /* 6 ── Kota di luar stok (Malang): tidak menanyakan area di kota kosong, sebut kota nyata */
  {
    const s = await runSim('6. Kota tidak ada di stok (Malang)', [
      'Mau sewa apartemen di Malang',
    ], generate);
    const r = s.replies[0].reply;
    ok('tidak menanyakan area/kawasan Malang', !/area mana di malang|kawasan mana di malang/i.test(r), r);
    ok('menyebut kota nyata yang dipegang (Surabaya/Sidoarjo/Gresik) atau menyatakan belum ada', /surabaya|sidoarjo|gresik|belum ada|tidak ada/i.test(r), r);
    ok('tidak mengirim kartu Malang', !(isCard(r) && /malang/i.test(r)), r);
  }

  /* 7 ── Area di luar stok di kota nyata: no-stock + alternatif nyata, bukan area diam-diam diganti */
  {
    const s = await runSim('7. Area tidak ada (Citraland, sewa rumah Surabaya)', [
      'Sewa rumah di Surabaya daerah Citraland',
    ], generate);
    const r = s.replies[0].reply;
    ok('jujur belum ada / menawarkan area nyata lain (bukan kartu Citraland karangan)', (/belum ada|tidak ada|area lain|berikut/i.test(r)) && !(isCard(r) && /citraland/i.test(r)), r);
  }

  /* 8 ── Pilih + survei ≤5 hari: tanggal DAN jam ditanya, summary Viewing absolut + Listing */
  {
    const s = await runSim('8. Pilih + survei besok (≤5 hari) -> jam ditanya', [
      'Beli rumah di Sidoarjo, Alana Cemandi',
      'Saya pilih no 1, mau survei',
      'Besok bisa',
      'Jam 10 pagi',
      'Itu saja Kak',
    ], generate);
    ok('setelah pilih+survei -> ditanya TANGGAL (satu pertanyaan)', /tanggal berapa/i.test(s.replies[1].reply) && (s.replies[1].reply.match(/\?/g) || []).length === 1, s.replies[1].reply);
    ok('"besok" (≤5 hari) -> jam DITANYA', /jam berapa/i.test(s.replies[2].reply), s.replies[2].reply);
    ok('jam 10 pagi -> jadwal dikonfirmasi absolut', hasAbsDate(s.replies[3].reply) && /jam 10/i.test(s.replies[3].reply), s.replies[3].reply);
    const sum = s.replies.find((r) => isSummary(r.reply));
    ok('summary: Viewing absolut + Listing', sum && /Viewing:\s*\*[^*]*\d{1,2}\s+\w+\s+20\d\d/.test(sum.reply) && /Listing:/.test(sum.reply), sum && sum.reply);
    ok('tidak ada kartu dikirim ulang setelah pilihan', !s.replies.slice(2).some((r) => isCard(r.reply)));
  }

  /* 9 ── Survei >5 hari: jam TIDAK ditanya, tanggal dicatat */
  {
    const s = await runSim('9. Survei 2 minggu lagi (>5 hari) -> jam tidak ditanya', [
      'Beli rumah di Sidoarjo, Candramas',
      'Pilih yang no 2, mau survei',
      '2 minggu lagi ya Kak',
    ], generate);
    const r = s.replies[2].reply;
    ok('tanggal absolut dicatat', hasAbsDate(r), r);
    ok('jam TIDAK ditanya', !/jam berapa/i.test(r), r);
  }

  /* 10 ── Pertanyaan atribut unit setelah pilih: dijawab dari kartu, tanpa katalog ulang */
  {
    const s = await runSim('10. Tanya atribut unit setelah pilih', [
      'Sewa apartemen di Surabaya, Kalijudan',
      'Saya pilih no 1',
      'Apakah unitnya banjir dan ada gym?',
    ], generate);
    const r = s.replies[2].reply;
    ok('dijawab tentang UNIT itu (bukan kartu ulang)', !isCard(r), r);
    ok('gym dibandingkan dengan data nyata (ada / belum tercatat)', /gym/i.test(r) && /ada|belum tercatat|tercatat/i.test(r), r);
    ok('banjir -> jujur belum tercatat / dikonfirmasi agent', /banjir|belum tercatat|agent/i.test(r), r);
  }

  /* 11 ── Menolak survei: dicatat sebagai jawaban, tidak ditanya ulang, alur lanjut */
  {
    const s = await runSim('11. Tolak survei ("belum mau, tanya-tanya dulu")', [
      'Beli rumah di Surabaya, Wiyung',
      'Pilih no 1',
      'Belum mau survei, saya tanya-tanya dulu',
      'Sertifikatnya apa?',
    ], generate);
    ok('penolakan survei tidak dibalas dengan tanya jadwal', !/tanggal berapa|jam berapa/i.test(s.replies[2].reply), s.replies[2].reply);
    ok('pertanyaan sertifikat sesudahnya tetap dijawab (bukan katalog/summary)', !isCard(s.replies[3].reply) && /sertifikat|shm|shgb|agent/i.test(s.replies[3].reply), s.replies[3].reply);
    ok('tidak pernah menanyakan survei lagi setelah ditolak', !s.replies.slice(3).some((r) => /mau saya jadwalkan survei/i.test(r.reply)));
  }

  /* 12 ── Keluhan harga: tidak spam katalog, direspons (probe budget / alternatif) */
  {
    const s = await runSim('12. Keluhan "kemahalan semua"', [
      'Beli rumah di Sidoarjo, Alana Cemandi',
      'Kemahalan semua Kak, ada yang lebih murah?',
    ], generate);
    const r = s.replies[1].reply;
    ok('keluhan direspons (budget / alternatif / area lain), bukan kartu yang sama diulang', /budget|murah|kisaran|area|alternatif|mulai/i.test(r), r);
    ok('kartu yang sama tidak dikirim ulang mentah-mentah', s.replies[1].reply !== s.replies[0].reply);
  }

  /* 13 ── Terima kasih SAJA saat Q8 sewa belum ditanya -> AI tanya Q8, lalu Masuk absolut */
  {
    const s = await runSim('13. "Ok trma ksh infonya" + Q8 sewa belum ditanya', [
      'Sewa rumah di Surabaya, Kenjeran',
      'Saya pilih no 1',
      'Ok, Kak. Trma ksh infonya',
      'Rencana bln 2 dpn',
      'Itu saja Kak',
    ], generate);
    ok('terima kasih saja -> BUKAN summary; AI menanyakan masuk/pindah', !isSummary(s.replies[2].reply) && /masuk|pindah/i.test(s.replies[2].reply), s.replies[2].reply);
    ok('jawaban tanggal masuk -> AI lanjut bertanya (bukan summary, bukan katalog)', !isSummary(s.replies[3].reply) && !isCard(s.replies[3].reply), s.replies[3].reply);
    const sum = s.replies.find((r) => isSummary(r.reply));
    ok('"bln 2 dpn" -> ✓ Masuk absolut di summary', sum && /Masuk:\s*\*[^*]*\d{1,2}\s+\w+\s+20\d\d/.test(sum.reply), sum && sum.reply);
    ok('summary TIDAK memuat Viewing (survei tidak pernah disetujui/dijadwalkan)', sum && !/Viewing:/.test(sum.reply), sum && sum.reply);
  }

  /* 14 ── Penutup keras -> summary sekali; setelahnya "makasih" tidak memicu summary kedua */
  {
    const s = await runSim('14. Penutup keras lalu makasih', [
      'Beli rumah di Surabaya, Dukuh Pakis',
      'Cukup, itu saja',
      'Makasih ya Kak',
    ], generate);
    ok('"cukup, itu saja" -> summary', isSummary(s.replies[1].reply), s.replies[1].reply);
    ok('"makasih" sesudah summary -> tidak ada summary kedua & tidak ada kartu', !isSummary(s.replies[2].reply) && !isCard(s.replies[2].reply), s.replies[2].reply);
  }

  /* 15 ── Gate C: 10+ percakapan tanpa penutup -> summary otomatis; sesudahnya masih dijawab */
  {
    const turns = [
      'Beli rumah di Sidoarjo, Candramas',
      'Ada yang 3 kamar?',
      'Yang no 1 luas tanahnya berapa?',
      'Sertifikatnya apa?',
      'Alamat lengkapnya?',
      'Masih tersedia?',
      'Ada carport?',
      'Harganya berapa?',
      'Bisa nego?',
      'Yang no 2 kamarnya berapa?',
      'Dekat sekolah nggak?',
      'Ada taman?',
    ];
    const s = await runSim('15. Gate C - 12 pesan tanpa penutup', turns, generate);
    const firstSummaryIdx = s.replies.findIndex((r) => isSummary(r.reply));
    ok('summary otomatis muncul pada pesan ke-10..12', firstSummaryIdx >= 9 && firstSummaryIdx <= 11, `idx=${firstSummaryIdx}`);
    const summaries = s.replies.filter((r) => isSummary(r.reply)).length;
    ok('summary tidak diulang', summaries <= 1, `summaries=${summaries}`);
    // Kartu TAMBAHAN untuk permintaan penyaringan ("ada yang 3 kamar?") sah — yang
    // dilarang: mengirim ulang kartu yang SUDAH terkirim / penomoran mulai dari 1 lagi.
    const cardReplies = s.replies.filter((r) => isCard(r.reply));
    const restartsAtOne = cardReplies.slice(1).some((r) => /^\s*1\.\s+\*/m.test(r.reply));
    ok('kartu tambahan melanjutkan nomor, tidak pernah mulai dari 1 lagi', !restartsAtOne);
    const addrs = cardReplies.flatMap((r) => [...r.reply.matchAll(/Alamat:\s*([^\n]+)/g)].map((m) => m[1].trim()));
    ok('tidak ada alamat kartu yang dikirim dua kali', new Set(addrs).size === addrs.length, addrs.join(' | '));
  }

  /* BONUS ── Transkrip Jambangan 14 Sep: buka "rumah", pilih APARTEMEN; Q4 "bersama keluarga" */
  {
    const s = await runSim('Bonus. Buka "rumah" -> pilih kartu apartemen; Q4 bersama keluarga', [
      'Mau sewa rumah di Surabaya, Kalijudan',
      'Saya pilih yang no 1',
      'Ok, Kak. Trma ksh infonya',
      'Rencana bln 2 dpn; Kak',
      'Bersama keluarga; Kak',
      'Itu saja Kak',
    ], generate);
    const sum = s.replies.find((r) => isSummary(r.reply));
    ok('summary terbentuk', Boolean(sum));
    if (sum) {
      // Invarian: "✓ Tipe" harus SAMA dengan baris "Tipe:" di kartu yang dipilih
      // (apa pun tipenya) — bukan kata pembuka customer.
      const pickedCardText = s.replies[0].reply;
      const cardType = (pickedCardText.match(/Tipe:\s*([A-Za-z-]+)/i) || [])[1] || '';
      const sumType = (sum.reply.match(/Tipe:\s*\*([^*]+)\*/i) || [])[1] || '';
      ok(`Tipe ringkasan (${sumType}) = Tipe kartu yang dipilih (${cardType})`, cardType && sumType && sumType.toLowerCase().startsWith(cardType.toLowerCase().slice(0, 5)), sum.reply);
      ok('Viewing TIDAK diisi dari jawaban tanggal MASUK', !/Viewing:/.test(sum.reply), sum.reply);
      ok('Masuk absolut dari "bln 2 dpn"', /Masuk:\s*\*[^*]*20\d\d/.test(sum.reply), sum.reply);
      ok('"bersama keluarga" -> Penghuni, BUKAN Keputusan bersama', /Penghuni:/.test(sum.reply) && !/Keputusan bersama:\s*\*Bersama keluarga/i.test(sum.reply), sum.reply);
      ok('Listing tercantum', /Listing:/.test(sum.reply));
    }
  }

  console.log(`\nRESULT: ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('CRASH', e); process.exit(1); });
