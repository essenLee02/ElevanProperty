/**
 * responseDebounce.js
 *
 * "Cookie" response timer — shared oleh Fonnte/Kirimi/TimelinesAI.
 *
 * Customer sering mengetik beberapa pesan terpisah dalam waktu singkat
 * (mis. "Belum pernah lihat" lalu detik berikutnya "Tapi saya mau cari yang
 * dekat stasiun bus"). Tanpa jeda, AI akan membalas pesan pertama sebelum
 * sempat membaca pesan susulan. Modul ini menahan proses selama
 * AI_COOKIE_RESPONSE_TIMER ms (default 20000) sejak pesan TERAKHIR diterima
 * dari customer tersebut — tiap pesan baru me-reset ulang jendela waktu ke
 * penuh. Setelah jendela berlalu tanpa pesan baru, semua pesan yang tertunda
 * digabung jadi satu teks lalu diproses sekali (satu balasan AI).
 *
 * Key harus unik per (platform + agent + customer), contoh:
 *   `kirimi_leon::628213311936`
 *
 * Usage:
 *   const { debounceMessage } = require('../utils/responseDebounce');
 *   debounceMessage(key, message, async (combinedMessage) => { ... });
 */

'use strict';

const RESPONSE_TIMER_MS = parseInt(process.env.AI_COOKIE_RESPONSE_TIMER || '20000', 10);

// key -> { messages: string[], timer: Timeout }
const _pending = new Map();

// ⚠️ MUTEX PER KEY — key -> Promise dari `onFire` yang SEDANG berjalan.
//
// BUG NYATA (produksi, 4 Agu 2026): timer lama menghapus `_pending.get(key)`
// SEBELUM memanggil `onFire` (async, bisa makan beberapa detik memanggil AI
// provider). Bila customer mengetik pesan BARU persis di jendela itu, tidak
// ada entry `_pending` untuk key ini lagi → pesan baru membuat batch/timer
// BARU yang independen → begitu timer BARU itu juga habis, `onFire` KEDUA
// terpanggil SEMENTARA `onFire` PERTAMA MUNGKIN MASIH BERJALAN. Dua panggilan
// AI paralel untuk SESI YANG SAMA, masing-masing membaca snapshot state yang
// berbeda dan mengambil keputusan "pertanyaan berikutnya" yang berbeda pula —
// keduanya terkirim ke customer. Gejala nyata: 3-4 balasan AI berbeda keluar
// dalam rentang waktu <2 menit, termasuk satu pesan yang terpotong di tengah
// kalimat (dua proses kirim yang saling menyalip).
//
// Fix: rantai setiap `onFire` baru ke promise `onFire` SEBELUMNYA untuk key
// yang sama. Batch baru yang tiba SAAT batch lama masih diproses akan
// MENUNGGU batch lama selesai — diproses SETELAHNYA, bukan BERBARENGAN.
const _inFlight = new Map();

/**
 * Tambahkan pesan ke buffer customer & reset timer ke RESPONSE_TIMER_MS penuh.
 * Setelah timer habis tanpa pesan baru, `onFire` dipanggil sekali dengan semua
 * pesan tertunda digabung (dipisah newline, urutan sesuai kedatangan).
 *
 * ⚠️ `onFire` untuk key yang sama DIJAMIN tidak pernah berjalan bersamaan —
 * lihat catatan `_inFlight` di atas.
 *
 * @param {string}   key     - identifier unik per percakapan (mis. `${source}::${normalizedPhone}`)
 * @param {string}   message - pesan customer yang baru masuk
 * @param {Function} onFire  - async (combinedMessage: string) => void
 */
function debounceMessage(key, message, onFire) {
  let state = _pending.get(key);
  if (!state) {
    state = { messages: [], timer: null };
    _pending.set(key, state);
  }

  state.messages.push(message);
  if (state.timer) clearTimeout(state.timer);

  state.timer = setTimeout(() => {
    _pending.delete(key);
    const combined = state.messages.join('\n');

    // Rantai ke onFire SEBELUMNYA (bila masih berjalan) untuk key yang sama —
    // mutex sederhana berbasis promise, tanpa library tambahan.
    const prev = _inFlight.get(key) || Promise.resolve();
    const run = prev
      .catch(() => {})   // error batch sebelumnya tidak boleh membatalkan batch ini
      .then(() => onFire(combined))
      .catch((err) => {
        console.error(`[COOKIE TIMER] onFire error untuk key "${key}":`, err.message);
      })
      .finally(() => {
        // Hanya hapus entry bila masih milik run INI (bukan run yang lebih baru
        // yang sudah menimpanya) — mencegah race saat batch ketiga tiba di
        // antara .then() dan .finally() batch kedua.
        if (_inFlight.get(key) === run) _inFlight.delete(key);
      });
    _inFlight.set(key, run);
  }, RESPONSE_TIMER_MS);
}

module.exports = { debounceMessage, RESPONSE_TIMER_MS };
