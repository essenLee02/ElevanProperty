import axios from 'axios';
import { refreshAccessToken, getCachedToken, clearCachedToken } from './authApi';
import { BACKEND_BASE_URL } from './backendBaseUrl';

// Construct API base URL from env variables
// baseURL disusun oleh helper bersama supaya bentuk PRODUKSI (tanpa port,
// mis. https://propmatches.fun/api) bisa dinyatakan — lihat backendBaseUrl.js.
const baseURL = BACKEND_BASE_URL;

const api = axios.create({
  baseURL,
  timeout: 90000,
  withCredentials: true,   // kirim refresh_token cookie (untuk silent refresh)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor — attach Bearer token dari localStorage jika ada
api.interceptors.request.use((config) => {
  const token = getCachedToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/* ════════════════════════════════════════════════════════════════════════════
   SILENT TOKEN REFRESH (anti auto-logout)
   ────────────────────────────────────────────────────────────────────────────
   Access token (Bearer) sengaja berumur pendek (mis. 5 menit) untuk keamanan.
   Saat token itu expired, backend balas 401. ALIH-ALIH langsung melempar user ke
   /login, interceptor ini diam-diam memanggil GET /auth/refresh memakai cookie
   refresh_token (HttpOnly). Selama user MASIH login (refresh_token cocok di DB),
   backend menerbitkan access token baru + merotasi refresh token → request asli
   diulang dengan token baru. User tidak pernah ter-logout otomatis hanya karena
   JWT-nya kedaluwarsa.

   Jika user SUDAH logout (refresh_token di DB sudah null) atau refresh token
   sudah benar-benar expired → /auth/refresh balas 401/403 → barulah kita bersihkan
   cache dan arahkan ke /login. Jadi token TIDAK terus digenerate untuk user yang
   sudah logout.

   SINGLE-FLIGHT: bila banyak request 401 berbarengan, hanya SATU panggilan
   /auth/refresh yang dijalankan (refreshPromise dibagikan). Ini mencegah race
   pada rotasi refresh token — kalau tidak, request kedua mengirim cookie lama
   yang sudah dirotasi dan ditolak DB, membuat user ter-logout keliru.
════════════════════════════════════════════════════════════════════════════ */

let refreshPromise = null;

function isAuthEndpoint(url = '') {
  return url.includes('/auth/refresh')
      || url.includes('/auth/login')
      || url.includes('/auth/logout');
}

function redirectToLogin() {
  clearCachedToken();
  // Hindari loop bila sudah berada di halaman login
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Response interceptor — coba silent-refresh dulu sebelum menyerah ke /login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status   = error?.response?.status;

    // Bukan 401, atau request rusak, atau ini memang endpoint auth → teruskan error
    if (!original || status !== 401 || isAuthEndpoint(original.url) || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      // Single-flight: hanya satu refresh berjalan untuk semua request yang 401 barengan
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      const result = await refreshPromise;

      const newToken = result?.data?.response?.token || getCachedToken();
      if (result?.isSuccess === 1 && newToken) {
        // Pasang token baru lalu ulangi request asli
        original.headers = original.headers || {};
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      }

      // Refresh "berhasil" tapi tanpa token → anggap sesi habis
      redirectToLogin();
      return Promise.reject(error);

    } catch (refreshErr) {
      // /auth/refresh gagal (user sudah logout / refresh token expired) → ke login
      redirectToLogin();
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
