'use strict';
/**
 * whatsappDuplicateCurrentMessage.test.js — M166
 * ------------------------------------------------
 * Temuan 29 Agu 2026, satu keluarga akar dengan M162 (TTL sesi tidak pernah
 * menyala): SIMPAN-DULU-BARU-BACA.
 *
 * Ketiga controller WhatsApp menyimpan pesan customer ke `chat_messages`
 * SEBELUM memanggil generateWhatsAppAIReply(). Jadi getConversationHistory()
 * sudah memulangkan pesan itu, lalu extractQualificationState() dulu
 * menambahkannya SEKALI LAGI sebagai entri "pesan saat ini".
 *
 * Salinan kedua itu menggeser `lastIdx` satu posisi melewati indeks tempat
 * resolver kanonik mencatat flip-nya, sehingga `runTxIdx === lastIdx` SELALU
 * false — dan SELURUH sistem reset mid-flow (M124/M132/M154/M163) tidak pernah
 * sekali pun menyala untuk customer WhatsApp. Hanya jalur web chat (yang tidak
 * menyimpan lebih dulu) yang pernah menjalankannya.
 *
 * Berkas ini mengunci SATU sifat: kedua bentuk pemanggilan harus menghasilkan
 * state yang sama. Tanpa itu, setiap tes reset mid-flow yang sudah ada tetap
 * hijau sambil produksi tetap rusak — persis yang terjadi selama ini.
 */
require('dotenv').config();

let pass = 0; let fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`); }
}

const { extractQualificationState } = require('../services/aiPromptBuilderService');

/** Jalankan skenario dalam DUA bentuk pemanggilan; kembalikan kedua state. */
async function bothShapes(history, currentMessage) {
  const web = await extractQualificationState(history, currentMessage);
  const wa = await extractQualificationState(
    [...history, { role: 'customer', message: currentMessage }], currentMessage
  );
  return { web, wa };
}

async function main() {
  console.log('\n=== M166 · Pesan saat ini terduplikasi di jalur WhatsApp ===\n');

  /* ── 1. Transkrip nyata: sewa → beli ─────────────────────────────────── */
  console.log('1) Transkrip produksi 29 Agu 2026 — ganti transaksi sewa → beli');
  const RENT_FLOW = [
    { role: 'user', message: 'Hello.. Saya mau sewa rumah di Madiun' },
    { role: 'ai',   message: 'Saya punya listing di Surabaya, Gresik dan Sidoarjo.' },
    { role: 'user', message: 'Di Surabaya' },
    { role: 'ai',   message: 'Di area mana di Surabaya?' },
    { role: 'user', message: 'Bukit Darmo Golf' },
    { role: 'ai',   message: 'Berapa kisaran budget-nya, Kak?' },
    { role: 'user', message: '36.300.000 per tahun' },
    { role: 'ai',   message: 'Belum ada yang sesuai budget Rp 36.300.000.' },
  ];
  const SWITCH = 'Kalau beli rumah di Kenjeran, apakah ada?';
  const { web, wa } = await bothShapes(RENT_FLOW, SWITCH);

  ok('web  : transaksi jadi sale', web.transactionType === 'sale', String(web.transactionType));
  ok('wa   : transaksi jadi sale', wa.transactionType === 'sale', String(wa.transactionType));
  ok('web  : budget sewa dibuang', web.budget === null, JSON.stringify(web.budget));
  ok('⭐ wa: budget sewa dibuang (dulu MELEKAT — bug produksi)',
    wa.budget === null, JSON.stringify(wa.budget));
  ok('wa   : flag ganti-transaksi menyala', wa.txChangedFromHistory === true,
    String(wa.txChangedFromHistory));
  ok('⭐ kedua bentuk menghasilkan budget yang sama',
    web.budget === wa.budget, `web=${JSON.stringify(web.budget)} wa=${JSON.stringify(wa.budget)}`);

  ok('tidak ada sisa periode sewa ("/tahun") di pencarian BELI',
    !/\/(tahun|bulan|minggu)/i.test(String(wa.budget || '')), JSON.stringify(wa.budget));

  /* ── 2. Ganti kota sendirian ─────────────────────────────────────────── */
  console.log('\n2) Ganti KOTA sendirian — area lama harus dilepas di kedua bentuk');
  const CITY_FLOW = [
    { role: 'user', message: 'Saya mau beli rumah di Surabaya' },
    { role: 'ai',   message: 'Di area mana di Surabaya?' },
    { role: 'user', message: 'Kenjeran' },
    { role: 'ai',   message: 'Baik, Kenjeran ya.' },
  ];
  const r2 = await bothShapes(CITY_FLOW, 'Kalau di Sidoarjo saja, Kak');
  ok('web : kota jadi Sidoarjo', /sidoarjo/i.test(String(r2.web.city || '')), String(r2.web.city));
  ok('wa  : kota jadi Sidoarjo', /sidoarjo/i.test(String(r2.wa.city || '')), String(r2.wa.city));
  ok('⭐ wa: area lama (Kenjeran) dilepas', !/kenjeran/i.test(String(r2.wa.district || '')),
    String(r2.wa.district));
  ok('kedua bentuk sepakat soal area', String(r2.web.district) === String(r2.wa.district),
    `web=${r2.web.district} wa=${r2.wa.district}`);

  /* ── 3. Ganti tipe properti sendirian ────────────────────────────────── */
  console.log('\n3) Ganti TIPE properti sendirian');
  const TYPE_FLOW = [
    { role: 'user', message: 'Saya mau beli rumah di Surabaya' },
    { role: 'ai',   message: 'Berapa budget-nya, Kak?' },
    { role: 'user', message: '500 juta' },
    { role: 'ai',   message: 'Baik, dicatat 500 juta.' },
  ];
  const r3 = await bothShapes(TYPE_FLOW, 'Ganti apartemen saja deh');
  ok('web : tipe jadi apartment', r3.web.buildingType === 'apartment', String(r3.web.buildingType));
  ok('⭐ wa: tipe jadi apartment', r3.wa.buildingType === 'apartment', String(r3.wa.buildingType));
  ok('kedua bentuk sepakat soal tipe', r3.web.buildingType === r3.wa.buildingType);

  /* ── 4. TANPA perubahan: jawaban segar TIDAK boleh ikut terhapus ─────── */
  console.log('\n4) Kontrol negatif — tanpa flip, slot yang baru diisi harus BERTAHAN');
  const STEADY = [
    { role: 'user', message: 'Saya mau beli rumah di Surabaya' },
    { role: 'ai',   message: 'Di area mana?' },
    { role: 'user', message: 'Kenjeran' },
    { role: 'ai',   message: 'Berapa budget-nya, Kak?' },
  ];
  const r4 = await bothShapes(STEADY, '500 juta');
  ok('wa  : budget baru tersimpan (tidak ikut ter-reset)',
    r4.wa.budget !== null, JSON.stringify(r4.wa.budget));
  ok('wa  : area tetap Kenjeran', /kenjeran/i.test(String(r4.wa.district || '')), String(r4.wa.district));
  ok('wa  : tidak ada flag ganti-transaksi palsu', !r4.wa.txChangedFromHistory);
  ok('kedua bentuk sepakat soal budget', String(r4.web.budget) === String(r4.wa.budget),
    `web=${r4.web.budget} wa=${r4.wa.budget}`);

  /* ── 5. Pesan identik berturut-turut tetap aman ──────────────────────── */
  console.log('\n5) Customer mengirim teks SAMA berkali-kali (nyata di transkrip)');
  const REPEAT = [
    { role: 'user', message: 'Saya mau beli rumah di Surabaya' },
    { role: 'ai',   message: 'Di area mana?' },
    { role: 'user', message: 'Saya pilih no 2, Kak' },
    { role: 'user', message: 'Saya pilih no 2, Kak' },
  ];
  const r5 = await bothShapes(REPEAT, 'Saya pilih no 2, Kak');
  ok('tidak crash & tipe tetap terbaca', r5.wa.buildingType === 'house', String(r5.wa.buildingType));
  ok('kota tetap Surabaya', /surabaya/i.test(String(r5.wa.city || '')), String(r5.wa.city));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
