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

/**
 * Tambahkan pesan ke buffer customer & reset timer ke RESPONSE_TIMER_MS penuh.
 * Setelah timer habis tanpa pesan baru, `onFire` dipanggil sekali dengan semua
 * pesan tertunda digabung (dipisah newline, urutan sesuai kedatangan).
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

  state.timer = setTimeout(async () => {
    _pending.delete(key);
    const combined = state.messages.join('\n');
    try {
      await onFire(combined);
    } catch (err) {
      console.error(`[COOKIE TIMER] onFire error untuk key "${key}":`, err.message);
    }
  }, RESPONSE_TIMER_MS);
}

module.exports = { debounceMessage, RESPONSE_TIMER_MS };
