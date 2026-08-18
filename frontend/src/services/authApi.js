/**
 * authApi.js
 *
 * Service untuk semua endpoint auth (login, register, refresh, logout, me).
 *
 * Format respon backend (sesuai requirement):
 * {
 *   status: 200,
 *   data: { response: <payload>, message: <text> },
 *   isSuccess: 1 | 2
 * }
 *
 * Helper di-export:
 * - registerUser(payload)
 * - loginUser(credentials)
 * - logoutUser()
 * - refreshAccessToken()
 * - getCurrentUser()
 * - getCachedToken() / setCachedToken() / clearCachedToken()
 */

import axios from 'axios';
import { BACKEND_BASE_URL } from './backendBaseUrl';

/**
 * Construct API base URL from env variables
 */
// baseURL disusun oleh helper bersama supaya bentuk PRODUKSI (tanpa port,
// mis. https://propmatches.fun/api) bisa dinyatakan — lihat backendBaseUrl.js.
const baseURL = BACKEND_BASE_URL;

/**
 * Axios instance khusus auth — selalu kirim cookies (withCredentials)
 * supaya refresh_token cookie tersedia di backend.
 */
const authClient = axios.create({
  baseURL,
  timeout: 90000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const TOKEN_STORAGE_KEY = 'elevan_access_token';
const USER_STORAGE_KEY  = 'elevan_user_info';

// =============================================================
// Local storage helpers
// =============================================================

export function setCachedToken(token, user) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (user)  localStorage.setItem(USER_STORAGE_KEY,  JSON.stringify(user));
}

export function getCachedToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
}

export function getCachedUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearCachedToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

// =============================================================
// Auth endpoints
// =============================================================

/**
 * Register user baru.
 * @param {object} payload - { name, birthdate, phone, username, password, konfirmasi }
 * @returns {Promise<{ user_id, name, username, ... }>}
 */
export async function registerUser(payload) {
  const response = await authClient.post('/auth/register', payload);
  return response.data;
}

/**
 * Login user.
 * @param {object} credentials - { username, password }
 * @returns {Promise<{ token, user }>}
 */
export async function loginUser(credentials) {
  const response = await authClient.post('/auth/login', credentials);

  // Cache token + user info ke localStorage untuk penggunaan berikutnya
  if (response.data?.isSuccess === 1 && response.data?.data?.response?.token) {
    setCachedToken(
      response.data.data.response.token,
      response.data.data.response.user
    );
  }

  return response.data;
}

/**
 * Logout user — hapus refresh_token di backend + cookie + cache.
 */
export async function logoutUser() {
  try {
    await authClient.delete('/auth/logout');
  } catch (err) {
    // Jangan tampilkan error logout ke user — tetap clear di frontend
    console.warn('Logout API error (ignored):', err?.message);
  }
  clearCachedToken();
}

/**
 * Refresh access_token pakai cookie refresh_token.
 * Backend juga akan rotasi refresh_token di DB & cookie.
 *
 * @returns {Promise<{ token, user }>}
 */
export async function refreshAccessToken() {
  const response = await authClient.get('/auth/refresh');

  if (response.data?.isSuccess === 1 && response.data?.data?.response?.token) {
    setCachedToken(
      response.data.data.response.token,
      response.data.data.response.user
    );
  }

  return response.data;
}

/**
 * Cek user yang sedang login (berdasarkan cookie refresh_token).
 */
export async function getCurrentUser() {
  const response = await authClient.get('/auth/me');
  return response.data;
}

/**
 * Cek apakah ada user yang sedang login (cek cache local + cookie).
 * Mengembalikan true kalau ada access_token di localStorage.
 */
export function isAuthenticated() {
  return !!getCachedToken();
}

export default authClient;
