import axios from 'axios';

// Construct API base URL from env variables
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const backendPort = import.meta.env.VITE_BACKEND_PORT || 5005;
const baseURL = `${backendUrl}:${backendPort}/api`;

const api = axios.create({
  baseURL,
  timeout: 90000,
  withCredentials: true,   // kirim refresh_token cookie (fallback di verifyToken)
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor — attach Bearer token dari localStorage jika ada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('elevan_access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — redirect ke /login jika server return 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Hapus token yang tidak valid dan arahkan ke halaman login
      localStorage.removeItem('elevan_access_token');
      localStorage.removeItem('elevan_user_info');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
