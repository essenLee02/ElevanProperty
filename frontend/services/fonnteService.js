const axios = require('axios');
const { normalizePhone } = require('../utils/normalizePhone');

function normalizeWhatsAppNumber(phone) {
  return normalizePhone(phone);
}

function normalizeFonnteError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const apiReason = data?.reason || data?.detail || data?.message || error?.message || 'Unknown Fonnte API error';

  if (status === 401 || String(apiReason).toLowerCase().includes('token')) {
    return new Error('Fonnte token is invalid or unauthorized. Please check FONNTE_TOKEN in backend .env.');
  }

  return new Error(`Fonnte API error${status ? ` (${status})` : ''}: ${apiReason}`);
}

async function sendWhatsAppMessage(phone, message) {
  if (!process.env.FONNTE_TOKEN) throw new Error('FONNTE_TOKEN is missing in backend .env');

  const target = normalizeWhatsAppNumber(phone);
  if (!target || !/^\d+$/.test(target)) {
    throw new Error('Invalid WhatsApp target number. Please use numbers with optional +, -, or spaces.');
  }

  const payload = new URLSearchParams();
  payload.append('target', target);
  payload.append('message', message);
  payload.append('countryCode', '0');
  payload.append('typing', 'true');

  try {
    const response = await axios.post('https://api.fonnte.com/send', payload, {
      headers: {
        Authorization: process.env.FONNTE_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 60000
    });

    if (response.data && response.data.status === false) {
      throw new Error(response.data.reason || response.data.detail || 'Fonnte failed to send WhatsApp message.');
    }

    return { target, response: response.data };
  } catch (error) {
    throw normalizeFonnteError(error);
  }
}

function checkFonnteConfig() {
  return { hasToken: Boolean(process.env.FONNTE_TOKEN) };
}

module.exports = {
  sendWhatsAppMessage,
  normalizeWhatsAppNumber,
  normalizeFonnteTarget: normalizeWhatsAppNumber,
  checkFonnteConfig
};
