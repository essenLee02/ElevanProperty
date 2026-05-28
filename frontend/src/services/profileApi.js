/**
 * profileApi.js
 *
 * Service untuk profile management endpoints.
 * Semua endpoint memerlukan authentication (user harus sudah login).
 */

import axios from 'axios';

// Construct API base URL dari env variables
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const backendPort = import.meta.env.VITE_BACKEND_PORT || 5005;
const baseURL = `${backendUrl}:${backendPort}/api`;

/**
 * Axios instance untuk profile — selalu kirim cookies (withCredentials)
 * supaya refresh_token cookie tersedia di backend.
 */
const profileClient = axios.create({
  baseURL,
  timeout: 90000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * GET /api/profile/me
 * Ambil data profile user yang sedang login
 * @returns {Promise<{ user_id, name, username, phone, birthdate }>}
 */
export async function getCurrentProfile() {
  const response = await profileClient.get('/profile/me');
  return response.data;
}

/**
 * PUT /api/profile/update-agent
 * Update nama, phone, birthdate, password, fonnte_api user.
 * Username TIDAK dikirim — backend mengabaikannya.
 * @param {object} payload - { name, phone, birthdate, password, fonnte_api }
 * @returns {Promise<{ user }>}
 */
export async function updateProfile(payload) {
  const response = await profileClient.put('/profile/update-agent', payload);

  // Update cached user info jika ada
  if (response.data?.isSuccess === 1 && response.data?.data?.response?.user) {
    const USER_STORAGE_KEY = 'elevan_user_info';
    const updatedUser = response.data.data.response.user;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
    console.log('✅ User cache updated:', updatedUser);
  }

  return response.data;
}

export default profileClient;
