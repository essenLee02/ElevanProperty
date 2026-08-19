/**
 * summaryAuditService.js — audit baris ✓ ringkasan sebelum dikirim (M119).
 *
 * ⚠️ SEMUA CACAT DI BAWAH DIAMBIL DARI TRANSKRIP PRODUKSI NYATA (13–19 Agu
 * 2026), bukan dugaan. Semuanya lolos dari aturan prompt, jadi dijaga
 * DETERMINISTIK di sini.
 *
 *   Case 3  budget "2-3 juta/MINGGU"      → ringkasan "Rp 2.000.000-3.000.000/MALAM"
 *   Case 3  customer tak pernah sebut     → "Area: Sidotopo"
 *   Case 4  properti di Jakarta           → "Area: Sidotopo" (kota lain!)
 *   Case 7  customer KOREKSI jadi 4 hari  → "Durasi: 2 hari" (nilai basi)
 *   Case 6  "Tdk mau dekat parkiran"      → "Area: Parkir Mobil" (fasilitas jadi area)
 *   Case 2  "ruko kosong" (tanpa tenant)  → "Furnitur: Kosongan" (slot tertukar)
 *   Case 8  template belum terisi         → "Rp [harga rendah]"
 *
 * INVARIAN INTI: setiap nilai ✓ harus BISA DILACAK ke sesuatu yang benar-benar
 * ditulis customer. Nilai yang tidak muncul di mana pun dalam pesan customer
 * adalah karangan — dan karangan di ringkasan jauh lebih berbahaya daripada
 * pertanyaan tambahan, karena agent menindaklanjutinya sebagai fakta.
 *
 * ⚠️ AUDIT, BUKAN SENSOR. Fungsi ini MELAPORKAN temuan; pemanggil yang
 * memutuskan (blokir, perbaiki, atau kirim dengan catatan). Memaksa perbaikan
 * otomatis di sini berisiko menghapus baris yang sebenarnya sah.
 */

'use strict';

const { expandAbbreviations } = require('../utils/lazyChatNormalizer');

/** Baris ringkasan: "✓ Label: nilai". */
const SUMMARY_LINE_RE = /^[\s>*_]*[✓✔]\s*([^:]{2,40}?)\s*:\s*(.+?)\s*$/;

/** Placeholder template yang belum terisi. */
const PLACEHOLDER_RE = /\[[a-z][a-z\s_/]{2,40}\]|\$\{[^}]{1,40}\}/i;

/**
 * Label yang nilainya TIDAK berasal langsung dari kata customer, jadi tidak
 * boleh diaudit sebagai "karangan". Contoh: tanggal hasil hitungan ("4 bulan
 * kedepan" → "15 Desember 2026") dan label yang diisi sistem.
 */
const DERIVED_LABELS = new Set([
  'masuk', 'masuk/check-in', 'target beli', 'target waktu', 'viewing',
  'keputusan bersama', 'prioritas', 'rencana', 'tipe',
]);

/** Satuan harga yang membedakan sewa harian vs bulanan vs total. */
const UNIT_ALIASES = [
  { re: /\/\s*malam|per\s*malam|\/\s*night/i, unit: 'malam' },
  { re: /\/\s*hari|per\s*hari|\/\s*day/i, unit: 'hari' },
  { re: /\/\s*minggu|per\s*minggu|\/\s*week/i, unit: 'minggu' },
  { re: /\/\s*bulan|per\s*bulan|\/\s*month/i, unit: 'bulan' },
  { re: /\/\s*tahun|per\s*tahun|\/\s*year/i, unit: 'tahun' },
];

function norm(text) {
  return String(expandAbbreviations(String(text || '').toLowerCase()) || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Satuan harga yang disebut dalam sebuah teks, atau '' bila tidak ada. */
function priceUnitOf(text) {
  for (const { re, unit } of UNIT_ALIASES) if (re.test(String(text || ''))) return unit;
  return '';
}

/** Pecah teks ringkasan menjadi baris {label, value}. */
function parseSummaryLines(summaryText) {
  return String(summaryText || '')
    .split('\n')
    .map((line) => {
      const m = line.match(SUMMARY_LINE_RE);
      return m ? { label: m[1].trim(), value: m[2].trim() } : null;
    })
    .filter(Boolean);
}

/**
 * Apakah nilai baris bisa ditelusuri ke pesan customer?
 *
 * Dicocokkan per-KATA, bukan frasa utuh: ringkasan biasanya merapikan kalimat
 * ("dekat alfamaret, Indomaret" → "Dekat Alfamaret dan Indomaret"), jadi
 * menuntut kecocokan persis akan menghasilkan banyak temuan palsu. Cukup
 * sebagian besar kata isi muncul di percakapan.
 */
function isTraceable(value, customerBlob, { minRatio = 0.5 } = {}) {
  const words = norm(value).split(' ').filter((w) => w.length > 2);
  if (!words.length) return true;
  const hit = words.filter((w) => customerBlob.includes(w)).length;
  return (hit / words.length) >= minRatio;
}

/**
 * Audit satu ringkasan terhadap pesan customer.
 *
 * @param {string} summaryText teks ringkasan yang akan dikirim
 * @param {Array<string|object>} customerMessages pesan customer (string atau {message})
 * @param {object} [opts]
 * @param {string} [opts.city] kota yang sedang dicari — untuk cek listing beda kota
 * @param {Array<string>} [opts.catalogLocations] lokasi listing yang ikut dikirim
 * @returns {{ok:boolean, findings:Array<{code:string, label:string, value:string, detail:string}>}}
 */
function auditSummary(summaryText, customerMessages = [], opts = {}) {
  const findings = [];
  const msgs = (customerMessages || []).map((m) => (typeof m === 'string' ? m : (m && m.message) || ''));
  const blob = norm(msgs.join(' '));
  const rows = parseSummaryLines(summaryText);

  const add = (code, label, value, detail) => findings.push({ code, label, value, detail });

  for (const { label, value } of rows) {
    const key = label.toLowerCase();

    // 1. Placeholder template belum terisi (Case 8).
    if (PLACEHOLDER_RE.test(value)) {
      add('placeholder', label, value, 'Placeholder template belum terisi nilai nyata.');
      continue;
    }

    // 2. Nilai tidak bisa ditelusuri ke ucapan customer (Case 3 & 4 "Sidotopo").
    if (!DERIVED_LABELS.has(key) && !isTraceable(value, blob)) {
      add('untraceable', label, value,
        'Nilai tidak ditemukan di pesan customer mana pun — kemungkinan karangan '
        + 'atau bocor dari percakapan lain.');
    }
  }

  // 3. Satuan harga berubah (Case 3: /minggu → /malam).
  const budgetRow = rows.find((r) => /budget|harga|anggaran/i.test(r.label));
  if (budgetRow) {
    const summaryUnit = priceUnitOf(budgetRow.value);
    const said = msgs.map(priceUnitOf).filter(Boolean);
    if (summaryUnit && said.length && !said.includes(summaryUnit)) {
      add('unit_mismatch', budgetRow.label, budgetRow.value,
        `Satuan harga di ringkasan "${summaryUnit}" tidak pernah disebut customer `
        + `(customer menyebut: ${[...new Set(said)].join(', ')}).`);
    }
  }

  // 4. Nilai basi setelah customer mengoreksi (Case 7: 2 hari → 4 hari).
  //    Angka+satuan durasi yang disebut PALING AKHIR adalah yang berlaku.
  const durRow = rows.find((r) => /durasi/i.test(r.label));
  if (durRow) {
    const DUR_RE = /(\d+)\s*(hari|malam|minggu|pekan|bulan|tahun)/gi;
    const mentions = [];
    for (const m of msgs.join(' ').matchAll(DUR_RE)) mentions.push(`${m[1]} ${m[2].toLowerCase()}`);
    if (mentions.length > 1) {
      const latest = mentions[mentions.length - 1];
      if (norm(durRow.value) !== norm(latest) && !norm(durRow.value).includes(norm(latest))) {
        add('stale_value', durRow.label, durRow.value,
          `Customer terakhir menyebut "${latest}" — ringkasan masih memakai nilai lama.`);
      }
    }
  }

  // 5. Listing dari kota lain (Case 4: Jakarta → listing Kulon Progo).
  // ⚠️ DIBANDINGKAN PER-KATA, BUKAN SUBSTRING. "JOGJAKARTA" MENGANDUNG
  // "jakarta" sebagai substring, sehingga listing Kulon Progo (Jogja) lolos
  // dianggap cocok untuk pencarian Jakarta — persis kesalahan yang hendak
  // ditangkap. Ini ditemukan oleh tesnya sendiri, bukan di produksi.
  const cityTokens = norm(opts.city || '').split(' ').filter(Boolean);
  if (cityTokens.length) {
    for (const loc of opts.catalogLocations || []) {
      const locTokens = new Set(norm(loc).split(' ').filter(Boolean));
      if (!locTokens.size) continue;
      if (!cityTokens.some((t) => locTokens.has(t))) {
        add('city_mismatch', 'Listing', String(loc),
          `Listing berada di "${loc}" sedangkan customer mencari di "${opts.city}".`);
      }
    }
  }

  return { ok: findings.length === 0, findings };
}

/** Ringkas temuan jadi teks satu-baris-per-temuan untuk log terminal. */
function formatFindings(findings = []) {
  if (!findings.length) return '';
  return findings
    .map((f) => `  [${f.code}] ✓ ${f.label}: ${f.value}\n      → ${f.detail}`)
    .join('\n');
}

module.exports = {
  SUMMARY_LINE_RE,
  DERIVED_LABELS,
  parseSummaryLines,
  priceUnitOf,
  isTraceable,
  auditSummary,
  formatFindings,
};
