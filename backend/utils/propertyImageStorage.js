/**
 * propertyImageStorage.js
 *
 * SATU SUMBER KEBENARAN untuk penyimpanan file gambar properti di disk +
 * pemetaan path ⇄ URL yang disimpan di `property_images.url`.
 *
 * LAYOUT DIREKTORI (root dari env PROPERTY_IMAGE_DIR)
 *   <root>/properties/            ← gambar DEFAULT per tipe bangunan (BERSAMA!)
 *   <root>/<PROPERTY_ID>/         ← gambar hasil upload user, milik 1 properti
 *
 * ATURAN PENTING (jangan diubah tanpa alasan kuat):
 *   1. Direktori `properties/` adalah DEFAULT BERSAMA yang dipakai ribuan baris
 *      property_images (mis. /assets/image_data/properties/house.png). Menghapus
 *      "gambar default" dari sebuah properti HANYA menghapus BARIS DB-nya —
 *      FILE-nya TIDAK BOLEH disentuh, karena masih dipakai properti lain.
 *   2. Menghapus gambar di `<PROPERTY_ID>/` menghapus baris DB **dan** file-nya
 *      (file itu memang eksklusif milik properti tersebut).
 *   3. Semua path hasil URL WAJIB lewat #safeResolve → cegah path traversal
 *      ("../"), sehingga tidak ada file di luar <root> yang bisa terhapus.
 *
 * URL yang disimpan ke DB bersifat relatif terhadap web root frontend:
 *   /assets/image_data/<PROPERTY_ID>/<file>
 * sehingga bisa dipakai langsung di <img src> tanpa mengetahui host backend.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/* ══════════════════════════════════════════════════════════════════════════════
   KONFIGURASI (dari .env — tidak ada hardcode nilai environment)
══════════════════════════════════════════════════════════════════════════════ */

/** Root direktori fisik tempat gambar disimpan. */
const IMAGE_ROOT = path.resolve(
  __dirname, '..',
  process.env.PROPERTY_IMAGE_DIR || '../frontend/public/assets/image_data'
);

/** Prefix URL publik yang disimpan di DB (harus cocok dengan layout frontend). */
const PUBLIC_URL_BASE = (process.env.PROPERTY_IMAGE_URL_BASE || '/assets/image_data')
  .replace(/\/+$/, '');

/** Nama folder gambar DEFAULT bersama — DILINDUNGI dari penghapusan file. */
const DEFAULT_DIR = process.env.PROPERTY_IMAGE_DEFAULT_DIR || 'properties';

/** Ekstensi yang diizinkan + MIME yang dipetakan ke ekstensi tersebut. */
const ALLOWED_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
  'image/avif': '.avif',
};

/** Batas ukuran & jumlah file per request (dari env, ada default wajar). */
const MAX_FILE_SIZE_MB = Number(process.env.PROPERTY_IMAGE_MAX_MB   || 5);
const MAX_FILES        = Number(process.env.PROPERTY_IMAGE_MAX_FILES || 10);

/** Panjang maksimum kolom property_images.url (STRING(100)). */
const MAX_URL_LENGTH  = 100;
/** Panjang maksimum kolom property_images.name (STRING(100)). */
const MAX_NAME_LENGTH = 100;

/* ══════════════════════════════════════════════════════════════════════════════
   PATH & URL
══════════════════════════════════════════════════════════════════════════════ */

/** Direktori fisik milik satu properti: <root>/<PROPERTY_ID> */
function propertyDir(propertyId) {
  return path.join(IMAGE_ROOT, String(propertyId).trim());
}

/** URL publik untuk sebuah file di dalam folder properti. */
function publicUrl(propertyId, fileName) {
  return `${PUBLIC_URL_BASE}/${String(propertyId).trim()}/${fileName}`;
}

/** Apakah URL ini menunjuk ke folder DEFAULT bersama (`properties/`)? */
function isDefaultImageUrl(url) {
  const u = String(url || '').replace(/\\/g, '/').trim();
  return u.startsWith(`${PUBLIC_URL_BASE}/${DEFAULT_DIR}/`);
}

/**
 * Ubah URL publik → path fisik absolut, DENGAN pengaman traversal.
 * Return null bila URL bukan milik IMAGE_ROOT atau mencoba keluar dari root.
 */
function resolveUrlToPath(url) {
  const u = String(url || '').replace(/\\/g, '/').trim();
  if (!u.startsWith(`${PUBLIC_URL_BASE}/`)) return null;

  const relative = decodeURIComponent(u.slice(PUBLIC_URL_BASE.length + 1));
  const abs      = path.resolve(IMAGE_ROOT, relative);

  // Pengaman: hasil resolve HARUS tetap di dalam IMAGE_ROOT.
  const rootWithSep = IMAGE_ROOT.endsWith(path.sep) ? IMAGE_ROOT : IMAGE_ROOT + path.sep;
  if (!abs.startsWith(rootWithSep)) return null;

  return abs;
}

/* ══════════════════════════════════════════════════════════════════════════════
   GAMBAR DEFAULT
══════════════════════════════════════════════════════════════════════════════ */

/**
 * URL gambar default untuk sebuah tipe bangunan.
 * Mencari <root>/properties/<building_type>.<ext>; bila tidak ada → others.*.
 * Return null bila keduanya tidak tersedia (folder default belum di-seed).
 *
 * @param {string} buildingType - mis. 'house', 'apartment', 'condo'
 * @returns {string|null} URL publik, mis. '/assets/image_data/properties/house.png'
 */
function defaultImageUrl(buildingType) {
  const dir  = path.join(IMAGE_ROOT, DEFAULT_DIR);
  const type = String(buildingType || '').trim().toLowerCase();
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];

  // Tipe seperti 'store' / 'condo' / 'mansion' belum punya file sendiri → others.
  for (const base of [type, 'others']) {
    if (!base) continue;
    for (const ext of exts) {
      if (fs.existsSync(path.join(dir, base + ext))) {
        return `${PUBLIC_URL_BASE}/${DEFAULT_DIR}/${base}${ext}`;
      }
    }
  }
  return null;
}

/**
 * Baris gambar "virtual" untuk properti yang belum punya gambar sama sekali.
 * Dipakai controller detail/list agar frontend selalu punya sesuatu untuk
 * ditampilkan TANPA menulis apa pun ke DB.
 *
 * @returns {{id:null,property_id:string,name:string,url:string,is_default:true}|null}
 */
function defaultImageRow(propertyId, buildingType) {
  const url = defaultImageUrl(buildingType);
  if (!url) return null;
  return {
    id:          null,
    property_id: propertyId,
    name:        'Gambar Default',
    url,
    is_default:  true,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   TULIS / HAPUS FILE
══════════════════════════════════════════════════════════════════════════════ */

/** Pastikan direktori properti ada (rekursif, idempoten). */
function ensurePropertyDir(propertyId) {
  const dir = propertyDir(propertyId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Bangun nama file aman & unik: <slug>-<random>.<ext>
 * Slug diambil dari nama asli agar file tetap mudah dikenali manusia; panjang
 * total dijaga supaya URL akhir tidak melewati MAX_URL_LENGTH kolom DB.
 */
function buildFileName(propertyId, originalName, mimeType) {
  const ext = ALLOWED_MIME[String(mimeType || '').toLowerCase()] || '.jpg';

  let slug = path.basename(String(originalName || 'image'), path.extname(String(originalName || '')))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')     // hanya alfanumerik + dash
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'image';

  const rand = Math.random().toString(36).slice(2, 8);

  // Sisakan ruang agar URL final ≤ MAX_URL_LENGTH.
  const prefixLen = `${PUBLIC_URL_BASE}/${propertyId}/`.length;
  const budget    = MAX_URL_LENGTH - prefixLen - rand.length - 1 - ext.length;
  if (budget < slug.length) slug = slug.slice(0, Math.max(1, budget));

  return `${slug}-${rand}${ext}`;
}

/**
 * Tulis satu buffer file ke folder properti.
 * @returns {{name:string,url:string,fileName:string,absPath:string}}
 */
function saveImageBuffer({ propertyId, buffer, originalName, mimeType }) {
  ensurePropertyDir(propertyId);
  const fileName = buildFileName(propertyId, originalName, mimeType);
  const absPath  = path.join(propertyDir(propertyId), fileName);

  fs.writeFileSync(absPath, buffer);

  return {
    fileName,
    absPath,
    url:  publicUrl(propertyId, fileName),
    name: String(originalName || fileName).slice(0, MAX_NAME_LENGTH),
  };
}

/**
 * Hapus FILE fisik milik sebuah URL — TIDAK PERNAH menyentuh folder default.
 * Aman dipanggil untuk URL apa pun: default / di luar root / file hilang → false.
 *
 * @returns {{deleted:boolean, reason:string}}
 */
function deleteImageFile(url) {
  if (isDefaultImageUrl(url)) {
    // Gambar default dipakai BERSAMA banyak properti — file wajib dipertahankan.
    return { deleted: false, reason: 'default-protected' };
  }
  const abs = resolveUrlToPath(url);
  if (!abs) return { deleted: false, reason: 'outside-root' };
  if (!fs.existsSync(abs)) return { deleted: false, reason: 'not-found' };

  try {
    fs.unlinkSync(abs);
    return { deleted: true, reason: 'ok' };
  } catch (err) {
    console.warn('[PropertyImage] gagal hapus file:', abs, '-', err.message);
    return { deleted: false, reason: 'unlink-failed' };
  }
}

/**
 * Hapus folder properti bila sudah KOSONG (housekeeping setelah gambar terakhir
 * dihapus). Folder default tidak pernah menjadi target karena namanya berbeda.
 */
function removePropertyDirIfEmpty(propertyId) {
  const dir = propertyDir(propertyId);
  if (path.basename(dir) === DEFAULT_DIR) return false;   // sabuk pengaman ekstra
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      return true;
    }
  } catch (_) { /* non-fatal */ }
  return false;
}

module.exports = {
  IMAGE_ROOT,
  PUBLIC_URL_BASE,
  DEFAULT_DIR,
  ALLOWED_MIME,
  MAX_FILE_SIZE_MB,
  MAX_FILES,
  MAX_NAME_LENGTH,
  propertyDir,
  publicUrl,
  isDefaultImageUrl,
  resolveUrlToPath,
  defaultImageUrl,
  defaultImageRow,
  ensurePropertyDir,
  buildFileName,
  saveImageBuffer,
  deleteImageFile,
  removePropertyDirIfEmpty,
};
