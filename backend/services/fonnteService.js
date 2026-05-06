const axios = require('axios');

const FONNTE_SEND_URL = 'https://api.fonnte.com/send';

function maskSecret(secret) {
  const value = String(secret || '').trim();
  if (!value) return '';
  if (value.length <= 8) return `${value.slice(0, 3)}...`;
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function normalizeWhatsAppNumber(phone) {
  let target = String(phone || '').trim();

  // Remove spaces and dash from contact form.
  // Example: +62 812-3456-7890 -> +6281234567890
  target = target.replace(/[\s\-]/g, '');

  if (target.startsWith('+')) {
    target = target.slice(1);
  }

  // Indonesian local format: 0812xxxx -> 62812xxxx
  if (target.startsWith('0')) {
    target = `62${target.slice(1)}`;
  }

  // If user inputs 812xxxx, assume Indonesia and convert to 62812xxxx
  if (target.startsWith('8')) {
    target = `62${target}`;
  }

  return target;
}

function normalizeFonnteError(error) {
  const status = error?.response?.status;
  const responseData = error?.response?.data;
  const apiMessage =
    responseData?.reason ||
    responseData?.detail ||
    responseData?.message ||
    error?.message ||
    'Unknown Fonnte error';

  if (status === 401 || status === 403) {
    return new Error(`Fonnte authorization failed. Please check FONNTE_TOKEN. Detail: ${apiMessage}`);
  }

  return new Error(`Fonnte API error${status ? ` ${status}` : ''}: ${apiMessage}`);
}

exports.normalizeWhatsAppNumber = normalizeWhatsAppNumber;

exports.getFonnteStatus = () => ({
  tokenLoaded: Boolean(String(process.env.FONNTE_TOKEN || '').trim()),
  tokenMasked: maskSecret(process.env.FONNTE_TOKEN)
});

exports.sendWhatsAppMessage = async (phone, message) => {
  const token = String(process.env.FONNTE_TOKEN || '').trim();

  if (!token) {
    throw new Error('FONNTE_TOKEN is missing in backend .env');
  }

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
    const response = await axios.post(FONNTE_SEND_URL, payload.toString(), {
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 90000
    });

    if (response.data && response.data.status === false) {
      throw new Error(response.data.reason || response.data.detail || 'Fonnte failed to send WhatsApp message.');
    }

    return {
      target,
      response: response.data
    };
  } catch (error) {
    if (error.response) {
      throw normalizeFonnteError(error);
    }

    throw error;
  }
};
