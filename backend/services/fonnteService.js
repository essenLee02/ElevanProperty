const axios = require('axios');

function normalizeWhatsAppNumber(phone) {
  let target = String(phone || '').trim();

  // Remove characters allowed in the form but not needed by Fonnte target.
  // Example: +62 812-3456-7890 -> 6281234567890
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
  const data = error?.response?.data;
  const apiReason =
    data?.reason ||
    data?.detail ||
    data?.message ||
    error?.message ||
    'Unknown Fonnte API error';

  if (status === 401 || String(apiReason).toLowerCase().includes('token')) {
    return new Error('Fonnte token is invalid or unauthorized. Please check FONNTE_TOKEN in backend .env.');
  }

  return new Error(`Fonnte API error${status ? ` (${status})` : ''}: ${apiReason}`);
}

function createFonnteFormData(payload) {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  return formData;
}

exports.normalizeWhatsAppNumber = normalizeWhatsAppNumber;

exports.sendWhatsAppMessage = async (phone, message) => {
  if (!process.env.FONNTE_TOKEN) {
    throw new Error('FONNTE_TOKEN is missing in backend .env');
  }

  const target = normalizeWhatsAppNumber(phone);

  if (!target || !/^\d+$/.test(target)) {
    throw new Error('Invalid WhatsApp target number. Please use numbers with optional +, -, or spaces.');
  }

  const formData = createFonnteFormData({
    target,
    message,
    countryCode: '0',
    typing: 'true'
  });

  try {
    const response = await axios.post('https://api.fonnte.com/send', formData, {
      headers: {
        Authorization: process.env.FONNTE_TOKEN
      },
      timeout: 60000
    });

    if (response.data && response.data.status === false) {
      throw new Error(response.data.reason || response.data.detail || 'Fonnte failed to send WhatsApp message.');
    }

    return {
      target,
      response: response.data
    };
  } catch (error) {
    throw normalizeFonnteError(error);
  }
};

exports.checkFonnteConfig = () => ({
  hasToken: Boolean(process.env.FONNTE_TOKEN)
});
