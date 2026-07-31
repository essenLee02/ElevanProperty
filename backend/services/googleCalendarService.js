/**
 * googleCalendarService.js
 *
 * Google Calendar API integration untuk scheduling property viewing/survey.
 * Fitur: create calendar events, set reminders (1 hari + 3 jam sebelum).
 *
 * PENTING — Kenapa bukan API Key:
 * Google Calendar API MENOLAK API Key untuk operasi tulis (create/update event) —
 * "API keys are not supported by this API. Expected OAuth2 access token..." (401).
 * API Key hanya untuk data publik/read-only (mis. Places/Maps).
 *
 * AUTH MODEL — OAuth 2.0 (bukan Service Account):
 * Semua event viewing dibuat di SATU calendar (`calendars/primary`, milik akun Google
 * yang menyelesaikan consent OAuth sekali di awal — biasanya akun bisnis/owner) — BUKAN
 * calendar pribadi tiap agent. Alasan: Service Account butuh SETIAP agent membagikan
 * Google Calendar mereka secara manual ke email Service Account (friksi operasional per
 * agent); OAuth atas SATU akun tidak butuh apa pun dari agent — customer & agent cukup
 * ditambahkan sebagai attendee (`sendUpdates=all`) dan Google mengirim email undangan ke
 * keduanya secara otomatis, terlepas dari calendar siapa event-nya berada.
 *
 * SETUP SEKALI (manual, wajib dilakukan manusia — lihat komentar di getOAuthClient()):
 * 1. Client ID/secret dari file GOOGLE_OAUTH_CLIENT_JSON_PATH (didownload dari
 *    Google Cloud Console → Credentials → OAuth 2.0 Client — tipe "Web application").
 * 2. Selesaikan consent SEKALI (mis. via Postman "Get New Access Token", redirect_uri
 *    di file harus PERSIS sama dengan yang terdaftar di Cloud Console) untuk
 *    mendapatkan REFRESH TOKEN.
 * 3. Simpan refresh token itu di .env sebagai GOOGLE_OAUTH_REFRESH_TOKEN.
 * Setelah itu, google-auth-library otomatis menukar refresh token → access token setiap
 * request, tanpa consent ulang, selamanya (kecuali token di-revoke dari akun Google).
 *
 * ENV: GOOGLE_OAUTH_CLIENT_JSON_PATH (default: ./asset/client_secret_*.json)
 *      GOOGLE_OAUTH_REFRESH_TOKEN (wajib — lihat SETUP SEKALI di atas)
 *      GOOGLE_CALENDAR_TIMEZONE (default: 'Asia/Jakarta')
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';
const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Jakarta';
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

// OAuth2 client di-cache di module scope — google-auth-library menangani refresh
// access-token otomatis dari refresh_token, jadi tidak perlu re-read file JSON
// di setiap request.
let _cachedAuthClient = null;

/**
 * Baca OAuth Client JSON + GOOGLE_OAUTH_REFRESH_TOKEN dan siapkan OAuth2Client
 * (lazy + cached).
 * @returns {OAuth2Client}
 * @throws {Error} jika file/refresh token tidak ada atau format invalid
 */
function getOAuthClient() {
  if (_cachedAuthClient) return _cachedAuthClient;

  const jsonPathFromEnv = process.env.GOOGLE_OAUTH_CLIENT_JSON_PATH
    || './asset/client_secret_282144058761-f40g1he7u5es1kjdpkug8neq01d7rqke.apps.googleusercontent.com.json';
  const jsonPath = path.resolve(process.cwd(), jsonPathFromEnv);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `OAuth Client JSON tidak ditemukan di: ${jsonPath}. ` +
      'Set GOOGLE_OAUTH_CLIENT_JSON_PATH di .env, atau letakkan file client_secret_*.json ' +
      'dari Google Cloud Console → Credentials di folder asset/.'
    );
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  const cfg = parsed.web || parsed.installed;

  if (!cfg || !cfg.client_id || !cfg.client_secret) {
    throw new Error('OAuth Client JSON tidak valid — missing client_id atau client_secret (field "web"/"installed").');
  }

  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      'GOOGLE_OAUTH_REFRESH_TOKEN belum di-set di .env. ' +
      'Lengkapi consent OAuth SEKALI (mis. via Postman "Get New Access Token" dengan client_id/' +
      'client_secret dari file ini, scope https://www.googleapis.com/auth/calendar.events, ' +
      'access_type=offline agar dapat refresh_token), lalu simpan refresh_token-nya di .env.'
    );
  }

  const redirectUri = Array.isArray(cfg.redirect_uris) ? cfg.redirect_uris[0] : undefined;
  const authClient = new OAuth2Client(cfg.client_id, cfg.client_secret, redirectUri);
  authClient.setCredentials({ refresh_token: refreshToken });

  _cachedAuthClient = authClient;
  return authClient;
}

// ─── Tipe Transaksi → Judul Event di Calendar
const EVENT_TITLES = {
  rent: 'Viewing Sewa Properti',
  sale: 'Viewing Beli Properti',
  booking: 'Viewing Booking Properti',
};

const EVENT_DESCRIPTIONS = {
  rent: 'Jadwal viewing untuk properti sewa. Customer akan bertemu agen untuk survey unit.',
  sale: 'Jadwal viewing untuk properti jual. Customer akan bertemu agen untuk survey unit.',
  booking: 'Jadwal viewing untuk properti booking. Customer akan bertemu agen untuk survey unit.',
};

/**
 * Format datetime ke ISO 8601 dengan timezone.
 * Input: dateString='2026-07-19', timeString='14:00' → output: '2026-07-19T14:00:00+07:00'
 * @returns {string} ISO datetime dengan timezone
 */
function formatDateTime(dateString = '', timeString = '10:00') {
  try {
    // dateString format: 'YYYY-MM-DD' atau '2026-07-19'
    // timeString format: 'HH:MM' atau '14:00'
    if (!dateString) return null;

    const [year, month, day] = dateString.split('-');
    const [hour, minute] = (timeString || '10:00').split(':');

    // Validate
    if (!year || !month || !day || !hour) return null;

    // ISO format: 2026-07-19T14:00:00+07:00 (UTC+7 for Jakarta)
    return `${year}-${month}-${day}T${hour}:${minute}:00+07:00`;
  } catch (err) {
    console.warn('[GoogleCalendar] formatDateTime error:', err.message);
    return null;
  }
}

/**
 * Hitung end time dari start time (default +1 jam viewing).
 * @param {string} startDateTime ISO datetime (2026-07-19T14:00:00+07:00)
 * @returns {string} ISO datetime +1 jam
 */
function getEndDateTime(startDateTime) {
  try {
    // Parse: 2026-07-19T14:00:00+07:00 → add 1 hour
    // Untuk simplicity, parse manual
    const match = startDateTime.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;

    const [_, date, hour, min, sec] = match;
    let endHour = parseInt(hour) + 1;
    const endMin = min;
    const endSec = sec;

    // Handle 24-hour overflow (sederhana — kalau jam jadi 24, tetap pakai jam 23)
    if (endHour >= 24) endHour = 23;

    return `${date}T${String(endHour).padStart(2, '0')}:${endMin}:${endSec}+07:00`;
  } catch (err) {
    console.warn('[GoogleCalendar] getEndDateTime error:', err.message);
    return null;
  }
}

/**
 * Buat calendar event di Google Calendar.
 *
 * @param {object} options
 * @param {string} options.agentEmail - Email agen (dari users model)
 * @param {string} options.customerName - Nama customer (untuk invite)
 * @param {string} options.customerEmail - Email customer (opsional)
 * @param {string} options.dateString - Tanggal viewing ('YYYY-MM-DD')
 * @param {string} options.timeString - Jam viewing ('HH:MM', default '10:00')
 * @param {string} options.propertyAddress - Alamat properti
 * @param {string} options.propertyType - Tipe properti (house, villa, apartment, dll)
 * @param {string} options.transactionType - 'rent' | 'sale' | 'booking'
 * @param {string} options.agentName - Nama agen (untuk description)
 *
 * @returns {Promise<object>} { success, eventId, eventLink, message, error }
 */
async function scheduleViewing(options = {}) {
  const {
    agentEmail,
    customerName,
    customerEmail,
    dateString,
    timeString = '10:00',
    propertyAddress = 'TBD',
    propertyType = 'properti',
    transactionType = 'rent',
    agentName = 'Agen Properti',
  } = options;

  // ── Validasi input
  if (!agentEmail) {
    return {
      success: false,
      message: 'Agen email tidak ditemukan. Tidak bisa buat jadwal viewing.',
      error: 'MISSING_AGENT_EMAIL',
    };
  }

  if (!dateString) {
    return {
      success: false,
      message: 'Tanggal viewing tidak valid.',
      error: 'INVALID_DATE',
    };
  }

  // ── Siapkan OAuth auth — API Key TIDAK didukung untuk create event
  let authClient;
  try {
    authClient = getOAuthClient();
  } catch (authErr) {
    console.warn('[GoogleCalendar] OAuth client setup error:', authErr.message);
    return {
      success: false,
      message: authErr.message,
      error: 'OAUTH_CLIENT_MISSING',
    };
  }

  try {
    // ── Format datetime
    const startDateTime = formatDateTime(dateString, timeString);
    const endDateTime = getEndDateTime(startDateTime);

    if (!startDateTime || !endDateTime) {
      return {
        success: false,
        message: 'Format tanggal/jam tidak valid.',
        error: 'DATETIME_FORMAT',
      };
    }

    // ── Build event body
    const attendees = [{ email: agentEmail, displayName: agentName }];
    if (customerEmail) {
      attendees.push({ email: customerEmail, displayName: customerName });
    }

    const eventBody = {
      summary: EVENT_TITLES[transactionType] || 'Viewing Properti',
      description:
        `${EVENT_DESCRIPTIONS[transactionType]}\n\n` +
        `📍 Lokasi: ${propertyAddress}\n` +
        `🏠 Tipe: ${propertyType}\n` +
        `👤 Customer: ${customerName}\n` +
        `🤝 Agen: ${agentName}`,
      start: { dateTime: startDateTime, timeZone: TIMEZONE },
      end: { dateTime: endDateTime, timeZone: TIMEZONE },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 }, // 1 hari = 24 jam × 60 min
          { method: 'email', minutes: 180 },  // 3 jam = 3 × 60 min
        ],
      },
    };

    // ── Ambil access token via refresh token (auto-refresh, google-auth-library)
    const { token: accessToken } = await authClient.getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        message: 'Gagal mendapatkan access token OAuth (refresh token mungkin di-revoke).',
        error: 'AUTH_FAILED',
      };
    }

    // ── POST ke 'primary' — calendar milik akun Google yang menyelesaikan OAuth consent.
    //    sendUpdates=all → Google otomatis kirim email undangan ke SEMUA attendees
    //    (agen via users.email + customer via customers.email, bila ada).
    console.log('[GoogleCalendar] Creating event on primary calendar for', dateString, 'at', timeString,
      '| attendees:', attendees.map(a => a.email).join(', '));
    const response = await axios.post(
      `${GOOGLE_CALENDAR_API_URL}/calendars/primary/events?sendUpdates=all`,
      eventBody,
      {
        headers: {
          'Content-Type' : 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    const { id: eventId, htmlLink: eventLink } = response.data;

    console.log('[GoogleCalendar] ✅ Event created:', eventId);

    return {
      success: true,
      eventId,
      eventLink,
      message: `Jadwal viewing telah dibuat di Google Calendar untuk ${dateString} jam ${timeString}.`,
      startDateTime,
    };
  } catch (err) {
    const status = err.response?.status;
    const googleMsg = err.response?.data?.error?.message || '';
    console.error('[GoogleCalendar] API Error:', err.response?.data || err.message);

    // Handle specific errors
    let errorMsg = 'Gagal membuat jadwal viewing di Google Calendar.';
    let errorCode = 'API_ERROR';

    if (status === 401 || /invalid_grant/i.test(err.message)) {
      errorMsg = 'Autentikasi OAuth gagal — GOOGLE_OAUTH_REFRESH_TOKEN tidak valid atau sudah di-revoke. ' +
        'Ulangi consent OAuth sekali lagi (lihat komentar getOAuthClient() di googleCalendarService.js) ' +
        'dan perbarui GOOGLE_OAUTH_REFRESH_TOKEN di .env.';
      errorCode = 'AUTH_FAILED';
    } else if (status === 403 || /caller does not have permission|insufficient.*scope/i.test(googleMsg)) {
      errorMsg = `Akun Google (pemilik refresh token) tidak punya izin menulis event, atau scope OAuth ` +
        `kurang. Pastikan consent dilakukan dengan scope https://www.googleapis.com/auth/calendar.events.`;
      errorCode = 'PERMISSION_DENIED';
    } else if (googleMsg) {
      errorMsg = `Google Calendar: ${googleMsg}`;
      errorCode = 'GOOGLE_ERROR';
    }

    return {
      success: false,
      message: errorMsg,
      error: errorCode,
      details: err.message,
    };
  }
}

/**
 * Detect viewing request dari pesan customer.
 * Cari pola: "tanggal X jam Y" atau "19 Juli jam 2 siang" atau "2026-07-19 jam 14:00" dll.
 *
 * @param {string} text
 * @returns {object|null} { dateString, timeString } atau null jika tidak ada viewing request
 */
function detectViewingDateTime(text = '') {
  if (!text) return null;

  const lower = text.toLowerCase();

  // Pattern 1: "tanggal 19 jam 14:00" atau "tanggal 19 Juli jam 2 siang"
  const pat1 = /tanggal\s+(\d{1,2})\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|peb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)?\s*jam\s+(\d{1,2})\s*(?::\s*(\d{2}))?\s*(?:pagi|siang|sore|malam)?/i;
  const match1 = text.match(pat1);
  if (match1) {
    const day = match1[1];
    const hour = match1[2];
    const min = match1[3] || '00';
    // Asumsi tahun sekarang (atau ekstrak dari context jika perlu)
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1; // Sederhana — seharusnya parse nama bulan
    return {
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      timeString: `${String(hour).padStart(2, '0')}:${min}`,
    };
  }

  // Pattern 2: "2026-07-19 jam 14:00" (ISO date)
  const pat2 = /(\d{4})-(\d{2})-(\d{2})\s+jam\s+(\d{1,2})\s*:\s*(\d{2})?/i;
  const match2 = text.match(pat2);
  if (match2) {
    const [_, year, month, day, hour, min] = match2;
    return {
      dateString: `${year}-${month}-${day}`,
      timeString: `${String(hour).padStart(2, '0')}:${min || '00'}`,
    };
  }

  // Pattern 3: "19 juli jam 14" (common in WhatsApp)
  const pat3 = /(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|januari|peb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\s+jam\s+(\d{1,2})\s*:?\s*(\d{2})?/i;
  const match3 = text.match(pat3);
  if (match3) {
    const day = match3[1];
    const monthName = match3[2].toLowerCase();
    const hour = match3[3];
    const min = match3[4] || '00';
    const year = new Date().getFullYear();

    // Map bulan
    const monthMap = {
      'januari': '01', 'januari': '01',
      'februari': '02', 'peb': '02',
      'maret': '03', 'mar': '03',
      'april': '04', 'apr': '04',
      'mei': '05',
      'juni': '06', 'jun': '06',
      'juli': '07', 'jul': '07',
      'agustus': '08', 'agu': '08',
      'september': '09', 'sep': '09',
      'oktober': '10', 'okt': '10',
      'november': '11', 'nov': '11',
      'desember': '12', 'des': '12',
    };

    const month = monthMap[monthName] || '01';
    return {
      dateString: `${year}-${month}-${String(day).padStart(2, '0')}`,
      timeString: `${String(hour).padStart(2, '0')}:${min}`,
    };
  }

  return null;
}

module.exports = {
  scheduleViewing,
  detectViewingDateTime,
  formatDateTime,
  getEndDateTime,
};
