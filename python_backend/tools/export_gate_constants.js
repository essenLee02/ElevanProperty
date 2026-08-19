/**
 * export_gate_constants.js
 *
 * Mengekspor konstanta INTERNAL utils/propertyKeywordFilter.js (Node.js) ke
 * JSON, untuk dipakai port Python.
 *
 * KENAPA BEGINI, BUKAN SALIN MANUAL:
 * daftar-daftar itu memuat ratusan entri dan setiap satunya membawa sejarah
 * perbaikan (mis. "booking" ditambahkan di M87 — tanpa itu SELURUH alur booking
 * tidak bisa dimulai; "jl" SENGAJA tidak ada di kamus singkatan). Menyalinnya
 * dengan tangan berarti mempertaruhkan seluruh sejarah itu pada ketelitian
 * mengetik. Mengekspor dari sumbernya menjadikan port Python turunan yang
 * TERBUKTI identik, bukan tiruan yang mirip.
 *
 * Jalankan:  node python_backend/tools/export_gate_constants.js
 * Keluaran:  python_backend/app/core/_gate_constants.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const SRC = path.resolve(__dirname, '..', '..', 'backend', 'utils', 'propertyKeywordFilter.js');
const OUT = path.resolve(__dirname, '..', 'app', 'core', '_gate_constants.json');

const NAMES = [
  'PROPERTY_TYPES',
  'RUMAH_EXCLUSIONS',
  'ACTION_WORDS',
  'ACTION_WORDS_STRICT_BOUNDARY',
  'STANDALONE_KEYWORDS',
  'PROPERTY_TYPES_STRICT_BOUNDARY',
  'PROPERTY_QUESTION_PATTERNS',
  // M99 — isPropertyContextContinuation (port Python)
  'DAILY_LIFE_OFFTOPIC',
  'CLEAR_NON_PROPERTY',
  'BANJIR_DAILY',
  'FLOOD_AVOID_PREFERENCE',
  'MACET_DAILY',
  'MACET_AVOID_PREFERENCE',
  'PANAS_AVOID_PREFERENCE',
  '_LOCATION_FALLBACK',
];

const source = fs.readFileSync(SRC, 'utf8');

// Tambahkan ekspor sementara di akhir sumber, lalu kompilasi sebagai modul.
// Sumber ASLI tidak disentuh — hanya salinan di memori.
const patched =
  source +
  `\nmodule.exports.__CONSTANTS__ = { ${NAMES.map((n) => `${n}: typeof ${n} !== 'undefined' ? ${n} : null`).join(', ')} };\n`;

const m = new Module(SRC, null);
m.filename = SRC;
m.paths = Module._nodeModulePaths(path.dirname(SRC));
m._compile(patched, SRC);

const raw = m.exports.__CONSTANTS__;

/** Set → Array, RegExp → sumber pola (agar bisa dipakai Python). */
function serialise(value) {
  if (value instanceof Set) return [...value];
  if (value instanceof RegExp) return { __regex__: value.source, flags: value.flags };
  if (Array.isArray(value)) return value.map(serialise);
  return value;
}

const out = {};
const missing = [];
for (const n of NAMES) {
  if (raw[n] == null) { missing.push(n); continue; }
  out[n] = serialise(raw[n]);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

console.log('Diekspor ke:', path.relative(process.cwd(), OUT));
for (const n of NAMES) {
  if (!out[n]) continue;
  console.log(`  ${n.padEnd(32)} ${Array.isArray(out[n]) ? out[n].length + ' entri' : 'objek'}`);
}
if (missing.length) console.warn('  ⚠️ tidak ditemukan:', missing.join(', '));
