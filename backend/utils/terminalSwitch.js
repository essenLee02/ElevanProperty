/**
 * terminalSwitch.js
 *
 * Utilitas untuk mengontrol platform mana yang menampilkan chat di terminal.
 * Dikontrol via .env: MASSEGE_TERMINAL=FONNTE
 *
 * Nilai yang didukung (satu atau lebih, pisah koma):
 *   FONNTE      → fonnteChatController tampil di terminal
 *   DIALOG      → dialogChatController tampil di terminal
 *   TIMELINESAI → timelinesAIChatController tampil di terminal
 *   CHAKRAHQ    → chakraHQController tampil di terminal
 *
 * Contoh:
 *   MASSEGE_TERMINAL=TIMELINESAI                        → hanya TimelinesAI tampil
 *   MASSEGE_TERMINAL=FONNTE,DIALOG                      → Fonnte dan Dialog tampil
 *   MASSEGE_TERMINAL=FONNTE,DIALOG,TIMELINESAI          → Fonnte, Dialog, TimelinesAI tampil
 *   MASSEGE_TERMINAL=FONNTE,DIALOG,TIMELINESAI,CHAKRAHQ → semua tampil
 */

'use strict';

/**
 * Cek apakah platform ini aktif untuk tampil di terminal.
 *
 * @param {'FONNTE'|'DIALOG'|'TIMELINESAI'|'CHAKRAHQ'} platform
 * @returns {boolean}
 */
function isTerminalActive(platform) {
  const raw    = String(process.env.MASSEGE_TERMINAL || 'FONNTE').toUpperCase().trim();
  const active = raw.split(',').map(s => s.trim()).filter(Boolean);
  return active.includes(platform.toUpperCase());
}

/**
 * Dapatkan daftar platform aktif dari .env.
 * @returns {string[]}
 */
function getActiveTerminals() {
  const raw = String(process.env.MASSEGE_TERMINAL || 'FONNTE').toUpperCase().trim();
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

module.exports = { isTerminalActive, getActiveTerminals };
