import api from './api';

export const sendChatbotMessage = (payload) => api.post('/chatbot/message', payload);
export const getChatbotConfig = () => api.get('/chatbot/config');
