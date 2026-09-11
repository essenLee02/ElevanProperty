'use strict';
/**
 * simulate-platform-skill.js — verifikasi LIVE skill × platform AI (M187/M188)
 *
 * Simulasi tanya-jawab customer ↔ AI lewat PINTU MASUK NYATA
 * (generateWhatsAppAIReply) dengan provider & skill persis seperti .env
 * (AI_PRIMARY_PROVIDER, AI_SKILL_CALL). Set skenario dipilih lewat argumen:
 *   node scripts/simulate-platform-skill.js house      (5 sesi, house_pilot)
 *   node scripts/simulate-platform-skill.js chatgpt    (8 sesi, chat_gpt_responds)
 * Setiap sesi 10-13 giliran customer (pertanyaan, keluhan, perubahan,
 * penolakan, permintaan, kebutuhan), giliran terakhir = sinyal penutup.
 *
 * Yang DIUKUR per giliran (bukan dinilai selera):
 *   1. provider === 'deepseek' → tidak ada balasan yang disusun backend
 *   2. tidak ada kalimat skrip interview backend (Q1–Q12 lama)
 *   3. tidak ada placeholder bocor ({{...}}, [Nama Agen], ${agentName})
 *   4. angka harga yang disebut AI ada di katalog agent (anti-mengarang)
 *   5. ≤ 1 tanda tanya per balasan; panjang ≤ 700 char bila tanpa kartu listing
 *   6. setelah "tanya-tanya dulu / tidak mau survei" → AI tidak menanyakan
 *      KPR/DP/cash/tanggal target
 *
 * ⚠️ Memanggil API DeepSeek berbayar sungguhan (≈50 panggilan). Tidak ada
 * auto-topup apa pun — hanya memakai saldo yang ada.
 *
 * Jalankan: node scripts/simulate-house-pilot-deepseek.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const AGENT = process.env.TEST_AGENT_USER_ID || 'NA40D8N007';
const SET = (process.argv[2] || 'chatgpt').toLowerCase();
const OUT = path.join(__dirname, '..', 'logs', `sim-${SET}-${new Date().toISOString().slice(0, 10)}.md`);

const BACKEND_SCRIPT_PHRASES = [
  /sudah lihat berapa/i, /apa yang membuat belum cocok/i, /ada target kapan proses beli/i,
  /tinggal bersama siapa saja/i, /baru\/ready, second/i, /furnished, semi-furnished, atau kosongan/i,
  /fasilitas yang wajib ada/i, /boleh balas "lihat listing saja"/i, /kisaran .* dan ada juga yang/i,
  /rencananya masuk bulan apa/i, /koordinasi dulu sama keluarga/i, /prioritas tinggi/i,
];
const FINANCE_PROBE = /\b(kpr|dp\b|down payment|cicilan|tenor|cash atau|secara cash|pembiayaan)\b/i;
const TARGET_PROBE = /target kapan|kapan proses beli|rencana masuk|masuk bulan/i;

const HOUSE_SCENARIOS = [
  {
    name: 'S1 — Beli rumah Candramas, tanya-tanya dulu, tolak survei & KPR',
    phone: '6280000031001', customer: 'Sim Satu',
    turns: [
      'Halo, saya mau beli rumah di Sidoarjo, area Candramas. Ada?',
      'Yang 3 kamar ada nggak?',
      'Harganya kok lumayan ya. Ada yang di bawah 800 juta?',
      'Saya masih tanya-tanya dulu ya, belum mau survei.',
      'Rumahnya banjir nggak kalau hujan?',
      'Sertifikatnya SHM?',
      'Kalau nego bisa berapa?',
      'Saya nggak mau bahas KPR dulu ya.',
      'Dekat sekolah nggak?',
      'Oke itu saja dulu, terima kasih infonya.',
    ],
  },
  {
    name: 'S2 — Sewa apartemen Surabaya, ganti area & keluhan diulang',
    phone: '6280000031002', customer: 'Sim Dua',
    turns: [
      'Sy cari apartemen sewa di Surabaya, daerah Pakuwon City.',
      'Budget sekitar 5 juta per bulan.',
      'Eh ganti deh, yang di Waterplace aja.',
      'Kok malah nanya lagi? Saya kan sudah bilang Waterplace.',
      'Yang furnished ada?',
      'Untuk 1 tahun, mulai November.',
      'Sudah termasuk IPL belum?',
      'Kalau nomor 1 itu lantai berapa?',
      'Boleh minta fotonya?',
      'Cukup segitu dulu, nanti saya kabari.',
    ],
  },
  {
    name: 'S3 — Beli rumah Gresik, ganti transaksi jadi sewa, pilih unit, mau survei',
    phone: '6280000031003', customer: 'Sim Tiga',
    turns: [
      'Ada rumah dijual di Gresik? Area Alam Djuanda.',
      'Saya berubah pikiran, sewa saja dulu, tetap di Alam Djuanda.',
      'Yang 2 kamar cukup, saya tinggal sama istri.',
      'Saya pilih yang nomor 2.',
      'Alamat lengkapnya di mana?',
      'Jauh nggak dari tol?',
      'Saya mau survei hari Sabtu ini jam 10 pagi.',
      'Bisa bawa mertua ikut lihat?',
      'Pemiliknya bisa ditemui waktu survei?',
      'Sip, ditunggu kabarnya ya.',
    ],
  },
  {
    name: 'S4 — Kota tanpa stok (Malang) lalu pindah ke Sidoarjo, dua penolakan',
    phone: '6280000031004', customer: 'Sim Empat',
    turns: [
      'Mau beli rumah di Malang, ada?',
      'Yah. Kalau Sidoarjo ada apa saja?',
      'Alana Cemandi boleh, lihat 2 pilihan.',
      'Nggak cocok, kejauhan dari kerja saya di Waru.',
      'Yang dekat Waru ada? Tropodo mungkin.',
      'Ini juga kurang sreg, tanahnya kecil.',
      'Saya butuh tanah minimal 120 m2.',
      'Kalau nggak ada ya sudah, jangan dipaksa.',
      'Nanti kalau ada yang 120 m2 kabari saja.',
      'Makasih ya.',
    ],
  },
  {
    name: 'S5 — Investasi ruko/rumah, off-topic selipan, frustasi, minta ringkasan',
    phone: '6280000031005', customer: 'Sim Lima',
    turns: [
      'Saya cari rumah untuk investasi disewakan, area Mulyorejo Surabaya.',
      'Biasanya harga sewanya berapa per tahun di situ?',
      'Btw semalam Persebaya menang ya haha',
      'Ok balik lagi. Yang paling murah berapa?',
      'Tolong jangan kirim listing yang sama dua kali ya.',
      'Pajak jual belinya berapa persen?',
      'Saya putuskan sendiri, nggak perlu konsul keluarga.',
      'Kapan bisa ketemu agennya?',
      'Tolong rangkum kebutuhan saya.',
      'Ok terima kasih.',
    ],
  },
];

const SCENARIOS = SET === 'house' ? HOUSE_SCENARIOS : require('./sim-scenarios-chat-gpt-responds');

const priceTokens = (text) => {
  const out = [];
  // 'm' hanya = miliar bila BUKAN satuan luas (m2 / m² / m persegi).
  const re = /(\d+(?:[.,]\d+)?)\s*(miliar|milyar|juta|jt|m(?![\s²2]|\s*persegi))/gi;
  let m;
  while ((m = re.exec(text))) {
    const num = parseFloat(m[1].replace(',', '.'));
    const unit = /mil|^m$/i.test(m[2]) ? 1e9 : 1e6;
    out.push(Math.round(num * unit));
  }
  return out;
};

async function main() {
  const { ChatSession, ChatMessage, Property } = require('../models');
  const { generateWhatsAppAIReply } = require('../services/whatsappAIService');
  const prs = require('../services/propertyRecommendationService');
  await prs.initLandmarkCache(); await prs.initCityCache(); await prs.initFacilityCache();

  const catalog = await Property.findAll({ where: { user_id: AGENT, status: 1 }, attributes: ['price'], raw: true });
  const prices = new Set(catalog.map((r) => Number(r.price)).filter(Boolean));
  const priceKnown = (p) => {
    for (const c of prices) if (Math.abs(c - p) / c < 0.02) return true;
    return false;
  };

  const report = [`# Simulasi ${SET} × ${process.env.AI_PRIMARY_PROVIDER} — ${new Date().toISOString()}`, '',
    `provider=${process.env.AI_PRIMARY_PROVIDER} · skill=${process.env.AI_SKILL_CALL} · agent=${AGENT} · katalog=${catalog.length} unit`, ''];
  const totals = { turns: 0, backendReplies: 0, scriptLeaks: 0, placeholderLeaks: 0, priceInvented: 0, multiQ: 0, tooLong: 0, financeAfterDecline: 0, targetAfterDecline: 0, cardRepeats: 0, noSummaryAtClose: 0, listingAfterSummary: 0, summaryFieldBad: 0 };

  for (const sc of SCENARIOS) {
    report.push(`## ${sc.name}`, '');
    const session = await ChatSession.create({
      name: sc.customer, normalizedName: sc.customer.toLowerCase(), phone: sc.phone, normalizedPhone: sc.phone,
      source: 'kirimi_whatsapp', lastMessageAt: new Date(),
    });
    let declined = false;
    const sentAddrs = new Set();
    try {
      for (let i = 0; i < sc.turns.length; i++) {
        const msg = sc.turns[i];
        await ChatMessage.create({ chatSessionId: session.id, role: 'user', message: msg, channel: 'kirimi_whatsapp' });
        const t0 = Date.now();
        let r;
        try {
          r = await generateWhatsAppAIReply({
            message: msg,
            session: { id: session.id, agentUserId: AGENT, agentName: 'Natasha', name: sc.customer, normalizedPhone: sc.phone, source: 'kirimi_whatsapp' },
            agentUserId: AGENT, agentName: 'Natasha',
          });
        } catch (e) { r = { reply: `[ERROR ${e.message}]`, provider: 'error' }; }
        const ms = Date.now() - t0;
        const reply = r.silent ? '[[SILENT]]' : String(r.reply || '');
        await ChatMessage.create({ chatSessionId: session.id, role: 'ai', message: reply, channel: 'kirimi_whatsapp' });
        totals.turns++;

        const flags = [];
        const PLATFORM = /^(deepseek|chatgpt|claude|kimi|qwen|openrouter|huggingface)$/;
        if (!PLATFORM.test(r.provider)) { flags.push(`provider=${r.provider}`); totals.backendReplies++; }
        if (BACKEND_SCRIPT_PHRASES.some((re) => re.test(reply))) { flags.push('SKRIP-BACKEND'); totals.scriptLeaks++; }
        if (/\{\{|\[Nama|\$\{agent|\$\{app/.test(reply)) { flags.push('PLACEHOLDER'); totals.placeholderLeaks++; }
        const unknown = priceTokens(reply).filter((p) => p >= 50e6 && !priceKnown(p));
        if (unknown.length) { flags.push(`HARGA-TAK-DIKENAL:${unknown.map((p) => p / 1e6 + 'jt').join(',')}`); totals.priceInvented++; }
        const qCount = (reply.match(/\?/g) || []).length;
        if (qCount > 1) { flags.push(`${qCount}×?`); totals.multiQ++; }
        const hasCard = /Estimasi Harga|📍|🏡/.test(reply);
        if (!hasCard && reply.length > 700) { flags.push(`${reply.length}ch>700`); totals.tooLong++; }
        if (/tanya-tanya dulu|belum mau survei|nggak mau bahas kpr|jangan dipaksa|lihat-lihat dulu|tidak usah tanya survei/i.test(msg)) declined = true;
        if (declined && FINANCE_PROBE.test(reply) && !/kpr/i.test(msg)) { flags.push('TANYA-PEMBIAYAAN-SETELAH-TOLAK'); totals.financeAfterDecline++; }
        if (declined && TARGET_PROBE.test(reply)) { flags.push('TANYA-TARGET-SETELAH-TOLAK'); totals.targetAfterDecline++; }

        // Skill chat_gpt_responds: giliran PENUTUP harus dibalas SUMMARY sekali (doc 04 §3d).
        if (SET === 'chatgpt' && i === sc.turns.length - 1) {
          // Summary = daftar ✓/• ber-label (Transaksi/Rencana, Tipe, Kota); format tanda tangan boleh beragam.
          const isSummary = /(✓|•)\s*(Rencana|Transaksi|Tipe|Kota)/.test(reply) && /(✓|•)\s*Tipe/.test(reply);
          if (!isSummary) { flags.push('TANPA-SUMMARY-DI-PENUTUP'); totals.noSummaryAtClose++; }
          else {
            if (/Estimasi Harga|📍 Lokasi/.test(reply)) { flags.push('LISTING-IKUT-SUMMARY'); totals.listingAfterSummary++; }
            if (/✓\s*Kota:\s*\*?[^*\n]*(?<![a-z])(tipe|no\.?|nomor)(?![a-z])/i.test(reply)) { flags.push('KOTA-SALAH-ISI'); totals.summaryFieldBad++; }
            if (/\(Belum ditanyakan\)|Disebutkan|N\/A/.test(reply)) { flags.push('NILAI-SAMAR'); totals.summaryFieldBad++; }
            if (/\[Nama|\$\{/.test(reply)) { flags.push('PLACEHOLDER-SUMMARY'); totals.placeholderLeaks++; }
          }
        }
        // Pengulangan kartu identik: alamat yang sama dikirim lagi setelah pernah dikirim.
        const addrs = reply.match(/Jl\.?\s[^\n,]{3,60}/g) || [];
        const dup = addrs.filter((a) => sentAddrs.has(a.trim()));
        if (dup.length && !/(nomor|no\.?)\s*\d|pilih/i.test(msg)) { flags.push(`ULANG-KARTU:${dup.length}`); totals.cardRepeats++; }
        addrs.forEach((a) => sentAddrs.add(a.trim()));

        report.push(`**C${i + 1}:** ${msg}`, '', `**AI** _(${r.provider}, ${ms} ms${flags.length ? ', ⚠️ ' + flags.join(' · ') : ''})_:`, '', reply.split('\n').map((l) => '> ' + l).join('\n'), '');
        console.log(`[${sc.name.slice(0, 2)} T${i + 1}] ${r.provider} ${ms}ms ${flags.length ? '⚠️ ' + flags.join(' · ') : '✓'}`);
      }
    } finally {
      await ChatMessage.destroy({ where: { chatSessionId: session.id } });
      await ChatSession.destroy({ where: { id: session.id } });
    }
  }

  report.push('## Ringkasan pengukuran', '', '| Metrik | Nilai |', '|---|---|');
  for (const [k, v] of Object.entries(totals)) report.push(`| ${k} | ${v} |`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, report.join('\n'), 'utf8');
  console.log('\nTOTALS', totals);
  console.log('report →', OUT);
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
