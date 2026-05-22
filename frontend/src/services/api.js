import axios from 'axios';

// Construct API base URL from env variables
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost';
const backendPort = import.meta.env.VITE_BACKEND_PORT || 5005;
const baseURL = `${backendUrl}:${backendPort}/api`;

const api = axios.create({
  baseURL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
