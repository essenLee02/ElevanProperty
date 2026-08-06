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

  const timeout    = parseInt(process.env.FONNTE_TIMEOUT_MS     || '30000', 10);
  const maxRetries = parseInt(process.env.FONNTE_RETRY_COUNT    || '3',     10);
  const retryDelay = parseInt(process.env.FONNTE_RETRY_DELAY_MS || '3000',  10);

  // Network error codes that warrant a retry (ETIMEDOUT = server unreachable at TCP level)
  const RETRYABLE = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'ECONNABORTED']);

  const payload = new URLSearchParams();
  payload.append('target',      target);
  payload.append('message',     message);
  payload.append('countryCode', '0');
  payload.append('typing',      'true');

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post('https://api.fonnte.com/send', payload, {
        headers: {
          Authorization:  process.env.FONNTE_TOKEN,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout,
      });

      if (response.data && response.data.status === false) {
        throw new Error(response.data.reason || response.data.detail || 'Fonnte failed to send WhatsApp message.');
      }

      if (attempt > 1) {
        console.log(`[FONNTE SERVICE] Send succeeded on attempt ${attempt}/${maxRetries}`);
      }
      return { target, response: response.data };

    } catch (error) {
      lastError = error;

      // Retry pada error JARINGAN **dan** HTTP 5xx/429 — bukan pada penolakan
      // API Fonnte (status:false) atau 4xx lain (kondisi permanen).
      // ⚠️ Lihat catatan M77 di kirimiChatController.sendViaKirimi: balasan
      // HTTP 5xx memberi error.code='ERR_BAD_RESPONSE' yang TIDAK ada di
      // RETRYABLE, sehingga dulu gangguan sesaat langsung menggugurkan kirim.
      const httpStatus   = error.response?.status;
      const isServerSide = httpStatus >= 500 && httpStatus <= 599;
      const isRateLimit  = httpStatus === 429;
      const isRetryable = RETRYABLE.has(error.code) ||
        (error.code === 'ECONNABORTED' && /timeout/i.test(error.message)) ||
        isServerSide || isRateLimit;
      if (!isRetryable || attempt >= maxRetries) break;

      const delay  = retryDelay * attempt;  // linear back-off: 3s, 6s, 9s …
      const reason = httpStatus ? `HTTP ${httpStatus}` : (error.code || error.message);
      console.warn(`[FONNTE SERVICE] Send attempt ${attempt}/${maxRetries} failed (${reason}). Retry in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Enhance the error message so logs show retry count
  if (lastError && maxRetries > 1) {
    const code = lastError.code || '';
    lastError.message = `${lastError.message} (after ${maxRetries} attempts)`;
    if (code) lastError.code = code;
  }
  throw normalizeFonnteError(lastError);
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
