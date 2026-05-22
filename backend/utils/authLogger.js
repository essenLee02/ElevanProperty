/**
 * authLogger.js
 *
 * Helper khusus untuk menampilkan log auth (login/register/refresh/logout)
 * di terminal backend dengan format yang konsisten dan mudah dibaca.
 *
 * Setiap event ditampilkan dalam bentuk box ASCII dengan:
 * - Timestamp lokal (ID locale)
 * - Status: SUCCESS / FAILED / WARN
 * - Action: REGISTER / LOGIN / REFRESH / LOGOUT / PAGE
 * - User info (user_id, username, name kalau tersedia)
 * - Reason / message untuk failure cases
 * - HTTP status code
 *
 * Selain ditampilkan ke terminal (console), juga di-pipe ke safeLog
 * supaya konsisten dengan logger global aplikasi.
 */

const { safeLog } = require('./safeLog');

/**
 * Generate timestamp lokal yang readable
 */
function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Map status text → emoji icon
 */
function statusIcon(status) {
  switch (String(status).toUpperCase()) {
    case 'SUCCESS':  return '✅';
    case 'FAILED':   return '❌';
    case 'WARN':
    case 'WARNING':  return '⚠️ ';
    case 'INFO':     return 'ℹ️ ';
    default:         return '•';
  }
}

/**
 * Map action text → emoji icon
 */
function actionIcon(action) {
  switch (String(action).toUpperCase()) {
    case 'REGISTER': return '📝';
    case 'LOGIN':    return '🔐';
    case 'LOGOUT':   return '🚪';
    case 'REFRESH':  return '🔄';
    case 'PAGE':     return '📄';
    default:         return '🔸';
  }
}

/**
 * Cetak baris pemisah
 */
function divider(char = '═', length = 64) {
  return char.repeat(length);
}

/**
 * Cetak satu baris di dalam box dengan padding kanan
 */
function boxLine(label, value, width = 60) {
  const text = `║ ${label}${value !== undefined ? ': ' + value : ''}`;
  return text;
}

/**
 * Print log auth event ke terminal.
 *
 * @param {object} opts
 * @param {string} opts.action       - REGISTER / LOGIN / REFRESH / LOGOUT / PAGE
 * @param {string} opts.status       - SUCCESS / FAILED / WARN
 * @param {object} [opts.user]       - { user_id, username, name }
 * @param {string} [opts.reason]     - Pesan error / detail
 * @param {number} [opts.httpStatus] - HTTP response code (200, 401, dll)
 * @param {object} [opts.extra]      - Field tambahan (ip, route, payload, dll)
 */
function logAuthEvent({ action, status, user = {}, reason = '', httpStatus, extra = {} }) {
  const isError = String(status).toUpperCase() === 'FAILED';
  const isWarn  = String(status).toUpperCase() === 'WARN' || String(status).toUpperCase() === 'WARNING';

  // Header box
  const headerText = `${actionIcon(action)} AUTH ${String(action).toUpperCase()} ${statusIcon(status)} ${String(status).toUpperCase()}`;

  console.log('');
  console.log('╔' + divider('═', 62) + '╗');
  console.log(`║ ${headerText}`);
  console.log('╠' + divider('═', 62) + '╣');
  console.log(boxLine('Timestamp', timestamp()));

  if (httpStatus !== undefined && httpStatus !== null) {
    console.log(boxLine('HTTP Status', httpStatus));
  }

  if (user && (user.user_id || user.username || user.name)) {
    if (user.user_id)  console.log(boxLine('User ID',  user.user_id));
    if (user.username) console.log(boxLine('Username', user.username));
    if (user.name)     console.log(boxLine('Name',     user.name));
  }

  // Tampilkan field extra (route, ip, payload size, dll)
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach((key) => {
      const val = extra[key];
      if (val !== undefined && val !== null && val !== '') {
        console.log(boxLine(key, typeof val === 'object' ? JSON.stringify(val) : String(val)));
      }
    });
  }

  if (reason) {
    console.log('╟' + divider('─', 62) + '╢');
    console.log(boxLine('Reason', reason));
  }

  console.log('╚' + divider('═', 62) + '╝');
  console.log('');

  // Pipe ke safeLog supaya konsisten dengan log aplikasi lainnya
  const safeLogLevel = isError ? 'error' : (isWarn ? 'warn' : 'info');
  safeLog(`AUTH_${String(action).toUpperCase()}_${String(status).toUpperCase()}`, {
    user_id:    user?.user_id,
    username:   user?.username,
    name:       user?.name,
    httpStatus,
    reason,
    ...extra
  }, safeLogLevel);
}

/**
 * Quick helpers
 */
const authLog = {
  registerSuccess: (user, extra = {})            => logAuthEvent({ action: 'REGISTER', status: 'SUCCESS', user, extra }),
  registerFailed:  (reason, extra = {}, user = {}) => logAuthEvent({ action: 'REGISTER', status: 'FAILED',  user, reason, ...extra }),

  loginSuccess:    (user, extra = {})            => logAuthEvent({ action: 'LOGIN', status: 'SUCCESS', user, extra }),
  loginFailed:     (reason, extra = {}, user = {}) => logAuthEvent({ action: 'LOGIN', status: 'FAILED',  user, reason, ...extra }),
  loginWarning:    (reason, extra = {}, user = {}) => logAuthEvent({ action: 'LOGIN', status: 'WARN',    user, reason, ...extra }),

  refreshSuccess:  (user, extra = {})            => logAuthEvent({ action: 'REFRESH', status: 'SUCCESS', user, extra }),
  refreshFailed:   (reason, extra = {}, user = {}) => logAuthEvent({ action: 'REFRESH', status: 'FAILED',  user, reason, ...extra }),

  logoutSuccess:   (user, extra = {})            => logAuthEvent({ action: 'LOGOUT', status: 'SUCCESS', user, extra }),
  logoutFailed:    (reason, extra = {}, user = {}) => logAuthEvent({ action: 'LOGOUT', status: 'FAILED',  user, reason, ...extra }),

  pageNavigation:  (extra = {})                  => logAuthEvent({ action: 'PAGE', status: 'INFO', extra })
};

module.exports = {
  logAuthEvent,
  authLog
};
