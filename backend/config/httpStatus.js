/**
 * httpStatus.js — kode status HTTP sebagai ANGKA (M121).
 *
 * ⚠️ MASALAH YANG DIPERBAIKI. Seluruh backend memanggil
 * `res.status(process.env.HTTP_OK)`. Nilai `process.env.*` SELALU string, jadi
 * Express mencatat:
 *
 *     express deprecated res.status("200"): use res.status(200) instead
 *
 * Bukan sekadar berisik: Express sudah menandainya deprecated dan pada versi
 * berikutnya `res.status()` dengan string akan MELEMPAR. Kalau itu terjadi di
 * webhook Kirimi, setiap pesan customer gagal dibalas — kelas kegagalan yang
 * sama dengan bug-bug diam lain di proyek ini.
 *
 * ⚠️ SATU LAGI YANG DIAM-DIAM BERBAHAYA: bila variabel .env hilang atau salah
 * eja, `process.env.HTTP_OK` bernilai `undefined`, dan `res.status(undefined)`
 * menghasilkan perilaku tak terduga TANPA pesan yang jelas. Di sini nilai
 * selalu punya fallback angka yang benar, jadi .env yang tidak lengkap tidak
 * bisa menjatuhkan respons.
 *
 * .env tetap boleh menimpa (beberapa integrasi minta 200 untuk semua kasus),
 * tapi nilainya di-parse jadi angka lebih dulu.
 */

'use strict';

/** Ambil kode dari .env sebagai ANGKA; fallback dipakai bila kosong/tidak valid. */
function code(envName, fallback) {
  const parsed = Number.parseInt(String(process.env[envName] ?? '').trim(), 10);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599 ? parsed : fallback;
}

const HTTP = Object.freeze({
  OK: code('HTTP_OK', 200),
  CREATED: code('HTTP_CREATED', 201),
  NO_CONTENT: code('HTTP_NO_CONTENT', 204),
  BAD_REQUEST: code('HTTP_BAD_REQUEST', 400),
  UNAUTHORIZED: code('HTTP_UNAUTHORIZED', 401),
  REJECTION: code('HTTP_REJECTION', 402),
  FORBIDDEN: code('HTTP_FORBIDDEN', 403),
  NOT_FOUND: code('HTTP_NOT_FOUND', 404),
  CONFLICT: code('HTTP_CONFLICT', 409),
  INTERNAL_SERVER_ERROR: code('HTTP_INTERNAL_SERVER_ERROR', 500),
  NOT_IMPLEMENTED: code('HTTP_NOT_IMPLEMENTED', 501),
  BAD_GATEWAY: code('HTTP_BAD_GATEWAY', 502),
});

module.exports = { HTTP, code };
