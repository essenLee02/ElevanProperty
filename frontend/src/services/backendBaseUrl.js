/**
 * backendBaseUrl.js — SATU sumber kebenaran untuk baseURL API backend.
 *
 * KENAPA ADA: tiga berkas (api.js, authApi.js, profileApi.js) dulu menyusun
 * sendiri `${backendUrl}:${backendPort}/api` dengan titik dua HARDCODED, plus
 * fallback `|| 5005`. Akibatnya konfigurasi PRODUKSI tidak bisa dinyatakan
 * sama sekali:
 *
 *   VITE_BACKEND_PORT=""      → falsy → fallback 5005 → https://domain:5005/api ❌
 *   VITE_BACKEND_PORT dihapus → sama saja                                        ❌
 *
 * Padahal di produksi backend diakses lewat HTTPS port standar (443) di balik
 * proxy Hostinger, sehingga URL yang benar adalah `https://domain/api` — TANPA
 * port sama sekali. Selama titik dua selalu ditempel, bentuk itu mustahil dibuat
 * dan seluruh panggilan API dari browser pengunjung gagal.
 *
 * ATURAN:
 *   - port KOSONG / tidak diisi        → tanpa port  → https://propmatches.fun/api
 *   - URL sudah memuat port sendiri    → dipakai apa adanya
 *   - URL https:// tanpa port          → tanpa port (443 standar)
 *   - selain itu (dev http://localhost)→ tempel :port
 */

/**
 * @param {string} [rawUrl]  VITE_BACKEND_URL, mis. "http://localhost" / "https://propmatches.fun"
 * @param {string|number} [rawPort]  VITE_BACKEND_PORT, boleh kosong di produksi
 * @returns {string} baseURL lengkap berakhiran /api
 */
export function buildBackendBaseUrl(rawUrl, rawPort) {
  const url = String(rawUrl ?? '').trim().replace(/\/+$/, '') || 'http://localhost';
  const port = String(rawPort ?? '').trim();

  // URL sudah membawa port sendiri ("http://localhost:5055") → jangan tempel lagi.
  const alreadyHasPort = /^https?:\/\/[^/]+:\d+/i.test(url);
  if (alreadyHasPort) return `${url}/api`;

  // Produksi: port sengaja dikosongkan → pakai port standar skema (80/443).
  if (!port) return `${url}/api`;

  // HTTPS tanpa port eksplisit dianggap produksi di balik proxy → tanpa port.
  // Ini mencegah "https://propmatches.fun:5055/api" yang tidak akan pernah bisa
  // dijangkau dari browser pengunjung.
  if (/^https:\/\//i.test(url)) return `${url}/api`;

  return `${url}:${port}/api`;
}

/** baseURL siap pakai dari environment Vite (dibaca saat BUILD, bukan runtime). */
export const BACKEND_BASE_URL = buildBackendBaseUrl(
  import.meta.env.VITE_BACKEND_URL,
  import.meta.env.VITE_BACKEND_PORT
);

export default BACKEND_BASE_URL;
