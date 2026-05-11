import api from './api';

export const submitContact = (payload) => api.post('/contact', payload);
export const checkGoogleSheetsStatus = () => api.get('/contact/google-sheets-status');
export const checkAiWhatsappStatus = (testOpenAI = false) => api.get(`/contact/ai-whatsapp-status${testOpenAI ? '?testOpenAI=true' : ''}`);
