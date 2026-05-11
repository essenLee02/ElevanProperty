import api from './api';

export const sendChatbotMessage = (payload) => api.post('/chatbot/message', payload);
