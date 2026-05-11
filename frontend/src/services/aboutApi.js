import api from './api';

export const getAboutData = (params = {}) => api.get('/about', { params });
