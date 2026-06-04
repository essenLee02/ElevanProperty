/**
 * logController.js
 *
 * Controller untuk menerima dan menyimpan log dari frontend.
 *
 * Endpoint: POST /api/log
 * Khusus action = 'PAGE_VIEW' (dari router.afterEach), tampilkan log
 * navigation user di terminal pakai box format yang konsisten dengan auth log.
 */

const { Log }           = require('../models');
const { maskSecrets }   = require('../utils/safeLog');
const { authLog }       = require('../utils/authLogger');

class LogController {

  // ── Helper: generate timestamp lokal yang readable ──────────────────────
  static #timestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  /**
   * POST /api/log
   *
   * Endpoint generic untuk frontend mengirim log apa pun.
   * Khusus action = 'PAGE_VIEW' (dari router.afterEach), tampilkan log
   * navigation user di terminal pakai box format yang konsisten dengan auth log.
   */
  static async insertLog(req, res) {
    const action   = String(req.body.action   || 'UNKNOWN');
    const details  = maskSecrets(req.body.details || '');
    const level    = String(req.body.level    || 'info');
    const username = req.body.username || req.body.user   || null;
    const userId   = req.body.user_id  || req.body.userId || null;

    // 1) Log PAGE_VIEW dengan format box supaya gampang dibaca admin
    if (action === 'PAGE_VIEW') {
      authLog.pageNavigation({
        ip:       req.ip || req.connection?.remoteAddress || 'unknown',
        route:    'POST /api/log',
        'User':   username || '(guest)',
        'UserID': userId   || '-',
        'Detail': details
      });
    } else {
      // 2) Log lainnya tampilkan ringkas
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log(`│ 📋 USER LOG  [${level.toUpperCase()}]  ${LogController.#timestamp()}`);
      console.log('├─────────────────────────────────────────────────────────────┤');
      console.log(`│ Action  : ${action}`);
      if (username) console.log(`│ User    : ${username}`);
      if (userId)   console.log(`│ UserID  : ${userId}`);
      console.log(`│ Details : ${details}`);
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('');
    }

    try {
      await Log.create({ action, details, level });
    } catch (error) {
      console.error('Failed to save log to database:', error.message);
    }

    return res.json({ success: true });
  }
}

module.exports = LogController;
