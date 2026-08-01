/**
 * eslint.config.js — pemindai VARIABEL TIDAK TERDEFINISI (no-undef).
 *
 * ⚠️ ALASAN FILE INI ADA (M62): sebuah referensi ke konstanta yang sudah dihapus
 * (`CITY_RE`) tertinggal di cabang kode yang jarang dieksekusi. Sintaksnya sah,
 * jadi `node --check` LOLOS dan seluruh test suite tetap hijau — tetapi di
 * produksi setiap giliran yang menyentuh cabang itu melempar ReferenceError,
 * jalur LLM batal, dan sistem diam-diam turun ke Private Agent. Customer hanya
 * melihat bot mengulang pertanyaan yang sama berjam-jam.
 *
 * Aturan di sini SENGAJA minimal: hanya kelas bug yang bisa mematikan produksi
 * secara senyap. Ini BUKAN linter gaya penulisan — jangan tambahkan aturan
 * kosmetik yang menghasilkan ribuan peringatan lalu diabaikan orang.
 *
 * Jalankan:  npm run lint
 */

'use strict';

module.exports = [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'asset/**',
      'tests/**',          // test boleh memakai helper inline
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js CommonJS
        require: 'readonly',   module: 'writable',   exports: 'writable',
        __dirname: 'readonly', __filename: 'readonly',
        process: 'readonly',   console: 'readonly',  Buffer: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',    clearTimeout: 'readonly',
        setInterval: 'readonly',   clearInterval: 'readonly',
        setImmediate: 'readonly',  clearImmediate: 'readonly',
        queueMicrotask: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly',
        fetch: 'readonly', FormData: 'readonly', Blob: 'readonly',
        AbortController: 'readonly', structuredClone: 'readonly',
        performance: 'readonly',
      },
    },
    rules: {
      // ⭐ Aturan inti — inilah yang akan menangkap bug seperti CITY_RE.
      'no-undef': 'error',
      // Pemanggilan fungsi yang tidak pernah didefinisikan di scope manapun.
      'no-obj-calls': 'error',
      // `return` di luar fungsi & unreachable code = kesalahan struktural nyata.
      'no-unreachable': 'error',
      // Duplikat nama fungsi/parameter — diam-diam menimpa implementasi.
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
      // Pemakaian variabel sebelum dideklarasikan (TDZ → ReferenceError runtime).
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }],
    },
  },
];
