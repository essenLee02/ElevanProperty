/**
 * pythonMirrorService.js — MENYALIN webhook WhatsApp masuk ke backend Python
 * (M104, 15 Agu 2026).
 *
 * KENAPA ADA:
 * Akun ngrok proyek ini HANYA punya SATU domain reserved (lihat V8 §5 M97).
 * Domain itu dipegang Node.js karena dialah yang melayani customer sungguhan,
 * sehingga tunnel Python selalu gagal dengan ERR_NGROK_334 ("endpoint already
 * online") dan python_backend TIDAK PERNAH menerima satu pun webhook. Akibat
 * yang terlihat pemilik produk: "AI membalas customer, tapi terminal Python
 * kosong" — bukan karena logger-nya rusak (logger-nya terbukti benar), tapi
 * karena tidak ada permintaan yang sampai ke sana.
 *
 * Modul ini menyalin payload yang SAMA ke Python lewat localhost, sehingga:
 *   • terminal Python menampilkan log pesan customer NYATA,
 *   • Python ikut menyimpan + menyusun balasan untuk dinilai berdampingan,
 *   • TANPA butuh domain ngrok kedua,
 *   • TANPA mengubah siapa yang membalas customer (tetap Node.js).
 * Ini juga pola shadow-testing yang tepat untuk masa migrasi.
 *
 * ⚠️ TIGA JAMINAN YANG TIDAK BOLEH DILANGGAR — modul ini menyentuh jalur
 * produksi yang melayani customer sungguhan:
 *   1. TIDAK PERNAH MELEMPAR. Semua kesalahan ditelan (di-log ringkas).
 *   2. TIDAK PERNAH MEM-BLOK. Dipanggil tanpa `await`; balasan ke Kirimi
 *      tidak menunggu Python.
 *   3. TIMEOUT PENDEK. Python mati/lambat tidak boleh menahan resource.
 * Kalau salah satu jaminan ini hilang, satu bug di backend Python bisa
 * menjatuhkan layanan WhatsApp produksi — persis yang harus dihindari.
 */

'use strict';

const axios = require('axios');

/** Aktif hanya bila di-set eksplisit — default MATI (aman). */
function isEnabled() {
  return String(process.env.PYTHON_MIRROR_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function baseUrl() {
  return String(process.env.PYTHON_MIRROR_URL || 'http://127.0.0.1:5056').replace(/\/+$/, '');
}

function timeoutMs() {
  const v = Number(process.env.PYTHON_MIRROR_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 4000;
}

/**
 * Kirim salinan payload webhook ke Python. Fire-and-forget.
 *
 * @param {'kirimi'|'fonnte'} terminal
 * @param {object} body payload webhook APA ADANYA (tidak diubah)
 * @returns {void} sengaja TIDAK mengembalikan promise, supaya pemanggil tidak
 *          tergoda meng-`await`-nya di jalur permintaan produksi.
 */
function mirrorInbound(terminal, body) {
  if (!isEnabled()) return;
  if (!body || typeof body !== 'object') return;

  const url = `${baseUrl()}/api/${terminal}/webhook`;

  // Tidak di-await: balasan ke Kirimi/Fonnte tidak boleh menunggu Python.
  axios.post(url, body, {
    timeout: timeoutMs(),
    headers: { 'Content-Type': 'application/json', 'X-Mirrored-From': 'nodejs' },
    // Status apa pun dianggap "selesai" — Python menjawab 200 walau pesan
    // di-skip gerbang, dan kita memang tidak peduli isinya.
    validateStatus: () => true,
  }).catch((err) => {
    const code = (err && err.code) || 'ERR';
    // ECONNREFUSED (Linux/umum) dan ECONNABORTED/ETIMEDOUT (Windows kerap
    // menggantung alih-alih menolak) sama-sama berarti "python_backend
    // sedang tidak jalan" — kondisi NORMAL karena Python memang opsional.
    // Jangan menakut-nakuti operator; cukup satu baris tenang.
    const offline = code === 'ECONNREFUSED' || code === 'ECONNABORTED' || code === 'ETIMEDOUT';
    if (offline) {
      logThrottled(`[PY-MIRROR] python_backend tidak aktif di ${baseUrl()} — salinan dilewati (produksi tidak terpengaruh).`);
    } else {
      logThrottled(`[PY-MIRROR] gagal menyalin ke Python (${code}): ${String(err.message || '').slice(0, 120)}`);
    }
  });
}

/**
 * Cetak paling banyak SEKALI per interval.
 *
 * ⚠️ Tanpa ini, Python yang mati saat trafik ramai membuat SATU baris
 * peringatan per pesan customer — log produksi tenggelam oleh pesan yang
 * isinya sama, dan justru menyulitkan menemukan masalah yang sungguhan.
 */
let _lastLogAt = 0;
let _suppressed = 0;
function logThrottled(message, intervalMs = 60000) {
  const now = Date.now();
  if (now - _lastLogAt < intervalMs) { _suppressed += 1; return; }
  const extra = _suppressed > 0 ? ` (+${_suppressed} kejadian serupa disembunyikan)` : '';
  _lastLogAt = now;
  _suppressed = 0;
  console.log(message + extra);
}

module.exports = { mirrorInbound, isEnabled, baseUrl };
