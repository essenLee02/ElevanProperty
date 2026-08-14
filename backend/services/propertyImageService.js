/**
 * propertyImageService.js — Memilih & meresolusi gambar properti untuk dikirim
 * lewat WhatsApp bersama summary/rekomendasi.
 *
 * SUMBER DATA: `Property.js` + `PropertyImage.js` (SUDAH ada, tidak diubah).
 * `PropertyImage.url` menyimpan path RELATIF (mis. `/assets/image_data/P001/
 * foto1.jpg`), dilayani statis oleh server.js di `PROPERTY_IMAGE_URL_BASE`.
 * WhatsApp (Kirimi `media_url`) butuh URL ABSOLUT yang bisa diakses dari luar
 * — fungsi di sini yang menjembatani keduanya.
 *
 * ⚠️ KORELASI KARTU↔GAMBAR YANG AMAN. Balasan katalog dibentuk oleh LLM dari
 * teks bebas (`propertyCtx`), TIDAK membawa `property_id` terstruktur yang bisa
 * dilacak balik dengan pasti. Mencocokkan gambar ke kartu berdasarkan URUTAN
 * bisa mengirim gambar properti YANG SALAH bila LLM mengubah urutan/menyingkat
 * daftar — kesalahan yang jauh lebih buruk daripada tidak mengirim gambar sama
 * sekali. Karena itu korelasinya lewat NAMA PROPERTI: hanya kirim gambar untuk
 * properti yang JUDULNYA benar-benar muncul di teks balasan yang SUDAH terkirim
 * ke customer — gagal-aman (fail-closed) terhadap ketidakcocokan.
 */

'use strict';

const path = require('path');

const ABSOLUTE_URL_RE = /^https?:\/\//i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif)$/i;

/** Batas jumlah properti yang boleh dikirimi gambar dalam SATU balasan. */
const MAX_IMAGES_PER_REPLY = Number(process.env.PROPERTY_IMAGE_MAX_PER_REPLY || 3);

/** Ambil root direktori & URL publik dari sumber tunggal yang sudah ada. */
function getImageUrlBase() {
  return (process.env.PROPERTY_IMAGE_URL_BASE || '/assets/image_data').replace(/\/+$/, '');
}

/**
 * Basis URL PUBLIK yang bisa diakses dari luar (WhatsApp/Kirimi mengambil
 * gambar dari internet, bukan dari localhost backend).
 *
 * Prioritas:
 *   1. PROPERTY_IMAGE_PUBLIC_BASE_URL — WAJIB diisi manual di produksi
 *      (domain sungguhan, mis. https://api.elevanproperty.com).
 *   2. Tunnel ngrok yang sedang aktif (dev) — dibaca dari ngrokService.
 *   3. null — pengirim gambar WAJIB fail-open (jangan kirim, jangan error)
 *      saat basis URL tidak diketahui; nomor rusak/domain localhost yang
 *      tidak bisa diakses WhatsApp lebih buruk daripada tidak mengirim apa pun.
 */
function getPublicBaseUrl() {
  const configured = String(process.env.PROPERTY_IMAGE_PUBLIC_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  try {
    // Lazy require — ngrokService hanya relevan saat dev, dan menghindari
    // dependency melingkar dengan server.js yang men-spawn ngrok.
    const { getCachedNgrokUrl } = require('./ngrokService');
    const cached = getCachedNgrokUrl?.();
    if (cached) return String(cached).replace(/\/+$/, '');
  } catch (_) { /* ngrokService tidak wajib ada */ }

  return null;
}

/**
 * Mengubah URL relatif (dari DB) menjadi URL absolut siap dikirim WhatsApp.
 * Mengembalikan null bila basis publik tidak diketahui ATAU ekstensinya bukan
 * format gambar yang didukung (png/jpg/jpeg/webp/gif/avif) — fail-open.
 */
function resolveAbsoluteImageUrl(relativeUrl) {
  const url = String(relativeUrl || '').trim();
  if (!url) return null;
  if (!IMAGE_EXT_RE.test(url)) return null; // bukan file gambar dikenal → jangan kirim

  if (ABSOLUTE_URL_RE.test(url)) return url; // sudah absolut (mis. dari Rumah123/CDN)

  const base = getPublicBaseUrl();
  if (!base) return null;

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${base}${normalizedPath}`;
}

/** Pilih SATU baris secara acak dari sebuah array (null bila kosong). */
function pickRandom(array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Mengambil satu gambar ACAK untuk sebuah properti.
 *
 * @param {string} propertyId
 * @returns {Promise<{url:string, absoluteUrl:string, name:string}|null>}
 */
async function getRandomImageForProperty(propertyId) {
  if (!propertyId) return null;

  let PropertyImage;
  try {
    ({ PropertyImage } = require('../models'));
  } catch (error) {
    console.warn('[PropertyImage] Model tidak bisa dimuat:', error.message);
    return null;
  }
  if (!PropertyImage) return null;

  try {
    const rows = await PropertyImage.findAll({
      where: { property_id: propertyId },
      attributes: ['url', 'name'],
      raw: true,
    });

    const chosen = pickRandom(rows);
    if (!chosen) return null;

    const absoluteUrl = resolveAbsoluteImageUrl(chosen.url);
    if (!absoluteUrl) return null; // basis URL publik belum diketahui / ekstensi tak dikenal

    return { url: chosen.url, absoluteUrl, name: chosen.name || path.basename(chosen.url) };
  } catch (error) {
    console.warn(`[PropertyImage] Query gagal untuk property_id=${propertyId}:`, error.message);
    return null;
  }
}

/**
 * Menemukan properti milik SATU agent yang namanya (title) benar-benar muncul
 * di teks balasan yang SUDAH dikirim ke customer, lalu memilih satu gambar
 * acak untuk masing-masing (dibatasi MAX_IMAGES_PER_REPLY).
 *
 * Pencocokan berbasis SUBSTRING JUDUL, bukan urutan/index — lihat catatan
 * korelasi di kepala berkas ini untuk alasannya.
 *
 * @param {string} replyText     teks balasan (summary + kartu katalog) yang SUDAH terkirim
 * @param {string} agentUserId   WAJIB — isolasi per-agent, tidak pernah lintas-agent
 * @returns {Promise<Array<{propertyId:string, title:string, absoluteUrl:string}>>}
 */
async function getImagesForMentionedProperties(replyText, agentUserId) {
  const text = String(replyText || '');
  if (!text.trim() || !agentUserId) return [];

  let Property;
  try {
    ({ Property } = require('../models'));
  } catch (error) {
    console.warn('[PropertyImage] Model Property tidak bisa dimuat:', error.message);
    return [];
  }
  if (!Property) return [];

  let candidates = [];
  try {
    candidates = await Property.findAll({
      where: { user_id: agentUserId },
      attributes: ['property_id', 'title'],
      limit: 500, // agent tunggal jarang punya lebih — batas jaga-jaga, bukan pemotong nyata
      raw: true,
    });
  } catch (error) {
    console.warn('[PropertyImage] Query kandidat properti gagal:', error.message);
    return [];
  }

  const mentioned = candidates.filter((p) => {
    const title = String(p.title || '').trim();
    return title.length >= 3 && text.toLowerCase().includes(title.toLowerCase());
  });

  const results = [];
  for (const property of mentioned.slice(0, MAX_IMAGES_PER_REPLY)) {
    const image = await getRandomImageForProperty(property.property_id);
    if (image) {
      results.push({
        propertyId: property.property_id,
        title: property.title,
        absoluteUrl: image.absoluteUrl,
      });
    }
  }

  return results;
}

module.exports = {
  getRandomImageForProperty,
  getImagesForMentionedProperties,
  resolveAbsoluteImageUrl,
  getPublicBaseUrl,
  getImageUrlBase,
  MAX_IMAGES_PER_REPLY,
};
