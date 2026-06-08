/**
 * dialogChatController.js
 *
 * Multi-agent WhatsApp handler menggunakan 360dialog API.
 * Mirip dengan fonnteChatController.js dan watiChatController.js.
 *
 * ── ARSITEKTUR ──────────────────────────────────────────────────────────────
 *  - Setiap agent punya token 360dialog sendiri (kolom dialog360_token di users)
 *  - Webhook dari 360dialog → backend identifikasi agent via header X-Agent-Id
 *  - X-Agent-Id dikirim oleh 360dialog karena kita set saat konfigurasi webhook
 *  - Balas pesan pakai token 360dialog milik agent itu sendiri
 *
 * ── SETUP SANDBOX ───────────────────────────────────────────────────────────
 *  1. Kirim "START" via WA ke +551146733492 → dapat API key
 *  2. Simpan API key ke kolom dialog360_token di DB
 *  3. Panggil POST /api/dialog-chat/setup-webhook?agentId=[user_id]
 *     → Backend otomatis daftarkan webhook URL ke 360dialog
 *  4. Kirim pesan WA ke nomor sandbox → terminal menampilkan chat
 *
 * ── 360DIALOG API REFERENCE ─────────────────────────────────────────────────
 *  Sandbox URL  : https://waba-sandbox.360dialog.io
 *  Production   : https://waba-v2.360dialog.io
 *  Auth header  : D360-API-KEY: [token]
 *  Send message : POST /v1/messages
 *  Set webhook  : POST /v1/configs/webhook
 *
 * ── WEBHOOK PAYLOAD (incoming message) ──────────────────────────────────────
 *  {
 *    "contacts": [{ "profile": { "name": "Nama User" }, "wa_id": "628XXX" }],
 *    "messages": [{
 *      "from"     : "628XXX",
 *      "id"       : "wamid.XXXX",
 *      "text"     : { "body": "isi pesan" },
 *      "timestamp": "1716800000",
 *      "type"     : "text"
 *    }]
 *  }
 *
 * ── WEBHOOK PAYLOAD (status update) ─────────────────────────────────────────
 *  {
 *    "statuses": [{
 *      "id"          : "wamid.XXXX",
 *      "recipient_id": "628XXX",
 *      "status"      : "read",    ← sent | delivered | read | failed
 *      "timestamp"   : "1716800000"
 *    }]
 *  }
 */

'use strict';

const axios  = require('axios');
const { User, ChatSession, ChatMessage } = require('../models');
const { safeLog }                        = require('../utils/safeLog');
const { hasPropertyKeyword,
        isPropertyContextContinuation }  = require('../utils/propertyKeywordFilter');
const { generateWhatsAppAIReply }        = require('../services/whatsappAIService');
const { getConversationHistory }         = require('../services/sessionService');
const {
  normalizePhone,
  findOrCreateSession,
  saveMessage,
  logTerminalSummary,
  logTerminalSkip,
} = require('../utils/whatsappUtils');

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 1 — CONFIG
══════════════════════════════════════════════════════════════════════════════ */

const DIALOG_SANDBOX_URL = 'https://waba-sandbox.360dialog.io';
const DIALOG_PROD_URL    = 'https://waba-v2.360dialog.io';

/**
 * Ambil base URL berdasarkan mode (sandbox vs production).
 * Kontrol via .env: DIALOG360_SANDBOX=true (default sandbox)
 */
function getBaseUrl() {
  const isSandbox = String(process.env.DIALOG360_SANDBOX || 'true').toLowerCase() !== 'false';
  return isSandbox ? DIALOG_SANDBOX_URL : DIALOG_PROD_URL;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 2 — PHONE UTILITIES
   normalizePhone diimport dari whatsappUtils (shared dengan WATI & Fonnte)
══════════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 3 — EVENT DETECTION
   360dialog webhook membedakan incoming (messages[]) vs status (statuses[])
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Deteksi jenis event dari payload 360dialog webhook.
 *
 * @param  {object} body - req.body dari webhook
 * @returns {'incoming'|'status'|'unknown'}
 */
function detectEventType(body) {
  if (!body || typeof body !== 'object') return 'unknown';

  // Incoming message: ada array messages dengan isi
  if (Array.isArray(body.messages) && body.messages.length > 0) return 'incoming';

  // Status update: ada array statuses
  if (Array.isArray(body.statuses) && body.statuses.length > 0) return 'status';

  return 'unknown';
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 4 — AGENT LOOKUP
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Ambil semua agent aktif yang sudah punya dialog360_token di database.
 */
async function getAllAgentsWithDialog() {
  const agents = await User.findAll({
    where      : { privilege: 'agent', status: 1 },
    attributes : ['id', 'user_id', 'name', 'phone', 'username', 'dialog360_token'],
    order      : [['created_date', 'ASC']]
  });

  return agents.filter(a => a.dialog360_token && String(a.dialog360_token).trim().length > 5);
}

/**
 * Cari agent berdasarkan header X-Agent-Id.
 *
 * Saat setup webhook per agent (via /setup-webhook), kita kirim:
 *   POST /v1/configs/webhook
 *   body: { url: "...", headers: { "X-Agent-Id": "[user_id]" } }
 *
 * 360dialog menyertakan header itu di setiap webhook request.
 * Kita lookup agent by user_id dari header tersebut.
 *
 * @param {string} agentId - nilai dari req.headers['x-agent-id']
 */
async function findAgentByHeaderId(agentId) {
  if (!agentId) return null;

  try {
    const agent = await User.findOne({
      where      : { user_id: String(agentId).trim(), privilege: 'agent', status: 1 },
      attributes : ['id', 'user_id', 'name', 'phone', 'username', 'dialog360_token']
    });

    if (agent && agent.dialog360_token && String(agent.dialog360_token).trim().length > 5) {
      console.log(`[DIALOG AGENT] ✅ Found by X-Agent-Id: ${agent.name}`);
      return agent;
    }
  } catch (err) {
    console.error('[DIALOG AGENT LOOKUP ERROR]', err.message);
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 5 — 360DIALOG API CLIENT
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Kirim pesan teks via 360dialog API menggunakan token agent.
 *
 * Endpoint: POST [base_url]/v1/messages
 * Header  : D360-API-KEY: [token]
 */
async function sendViaDialog(targetPhone, messageText, agentToken) {
  const target  = normalizePhone(targetPhone);
  const baseUrl = getBaseUrl();

  const body = {
    messaging_product : 'whatsapp',
    recipient_type    : 'individual',
    to                : target,
    type              : 'text',
    text              : { body: String(messageText).trim() }
  };

  const response = await axios.post(`${baseUrl}/v1/messages`, body, {
    headers : {
      'D360-API-KEY'  : String(agentToken).trim(),
      'Content-Type'  : 'application/json'
    },
    timeout : 30000
  });

  // Cek error di response body
  if (response.data && response.data.error) {
    throw new Error(`360dialog: ${response.data.error}`);
  }

  return response.data;
}

/**
 * Daftarkan webhook URL ke 360dialog untuk satu agent.
 *
 * 360dialog akan menyertakan header X-Agent-Id di setiap webhook request,
 * sehingga backend bisa identifikasi agent mana yang menerima pesan.
 *
 * Endpoint: POST [base_url]/v1/configs/webhook
 * Header  : D360-API-KEY: [token]
 * Body    : { "url": "...", "headers": { "X-Agent-Id": "[user_id]" } }
 */
async function registerWebhook(agentToken, agentUserId, webhookUrl) {
  const baseUrl = getBaseUrl();

  const body = {
    url    : webhookUrl,
    headers: { 'X-Agent-Id': String(agentUserId).trim() }
  };

  const response = await axios.post(`${baseUrl}/v1/configs/webhook`, body, {
    headers : {
      'D360-API-KEY'  : String(agentToken).trim(),
      'Content-Type'  : 'application/json'
    },
    timeout : 15000
  });

  return response.data;
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 6 — AI REPLY (ChatGPT → Claude → Private Agent)
══════════════════════════════════════════════════════════════════════════════ */

// ✅ UPDATED: generateAIReply removed — now using whatsappAIService.generateWhatsAppAIReply
// This centralizes AI logic across all WhatsApp platforms (Fonnte, WATI, 360dialog)

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 7 — TERMINAL LOGGER
   logTerminalSummary & logTerminalSkip diimport dari whatsappUtils.
   logIncomingMessage (raw preview) & logStatusUpdate tetap lokal karena
   spesifik untuk format 360dialog.
══════════════════════════════════════════════════════════════════════════════ */

function logIncomingMessage(agentName, agentPhone, senderPhone, senderName, messageText, msgType, timestamp) {
  const { isTerminalActive } = require('../utils/terminalSwitch');
  if (!isTerminalActive('DIALOG')) return;

  const divider = '─'.repeat(62);
  const ts      = timestamp
    ? new Date(Number(timestamp) * 1000).toISOString()
    : new Date().toISOString();

  console.log('');
  console.log(divider);
  console.log(`[360DIALOG] Agent    : ${agentName} - ${agentPhone || 'N/A'}`);
  console.log(`            Customer : ${senderPhone} (${senderName})`);
  console.log(`            Time     : ${ts}`);
  console.log(`            Type     : ${msgType}`);
  console.log(`            Message  : ${String(messageText || '(media/non-teks)').substring(0, 100)}`);
  console.log(divider);
  console.log('');
}

function logStatusUpdate(recipientId, status, msgId) {
  const { isTerminalActive } = require('../utils/terminalSwitch');
  if (!isTerminalActive('DIALOG')) return;
  console.log(`[360DIALOG STATUS] recipient=${recipientId} status=${status} id=${msgId}`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 8 — MESSAGE PROCESSOR (DB save + AI + send)
══════════════════════════════════════════════════════════════════════════════ */

/**
 * Proses satu incoming message:
 *   1. Log ke terminal
 *   2. Simpan ke database
 *   3. Generate AI reply
 *   4. Kirim balasan via 360dialog
 */
async function processIncomingMessage(msg, contacts, agent) {
  // ── Ekstrak field dari 360dialog payload ────────────────────────────────
  const senderPhone   = String(msg.from || '').trim();
  const messageId     = String(msg.id   || '').trim();
  const msgType       = String(msg.type || 'text').trim();
  const msgTimestamp  = msg.timestamp || null;

  // Nama customer dari array contacts (cocokkan wa_id dengan sender)
  const contactEntry  = (contacts || []).find(c => c.wa_id === senderPhone);
  const senderName    = contactEntry?.profile?.name || 'Customer';

  // Isi pesan (hanya untuk type: text)
  const messageText   = msgType === 'text'
    ? String(msg.text?.body || '').trim()
    : `[${msgType}]`;  // non-teks: [image], [audio], [video], dll

  // ── Terminal log ─────────────────────────────────────────────────────────
  logIncomingMessage(
    agent?.name  || 'UNASSIGNED',
    agent?.phone || 'N/A',
    senderPhone,
    senderName,
    messageText,
    msgType,
    msgTimestamp
  );

  // ── Jika tidak ada agent atau bukan teks → skip ──────────────────────────
  if (!agent) {
    console.warn('[360DIALOG] Tidak ada agent ditemukan untuk pesan ini');
    return;
  }
  if (msgType !== 'text' || !messageText || messageText.startsWith('[')) {
    console.log(`[360DIALOG] Tipe pesan ${msgType} — skip AI reply`);
    return;
  }

  const ts = msgTimestamp
    ? new Date(Number(msgTimestamp) * 1000).toISOString()
    : new Date().toISOString();

  // ── Find / create session (shared util) ──────────────────────────────────
  const session = await findOrCreateSession({
    customerPhone : senderPhone,
    customerName  : senderName,
    agentName     : agent.name,
    platform      : 'dialog360'
  });

  // ── Simpan pesan customer (selalu) ───────────────────────────────────────
  await saveMessage(session, 'customer', messageText, {
    agentName : agent.name,
    messageId,
    platform  : 'dialog360',
    msgType
  });

  // ── Cek kata kunci properti / lanjutan percakapan ───────────────────────
  const isPropertyQuery = hasPropertyKeyword(messageText);

  let isContinuation = false;
  if (!isPropertyQuery) {
    try {
      const history = await getConversationHistory(session.id, 6);
      isContinuation = isPropertyContextContinuation(messageText, history);
    } catch (_) { /* skip jika history gagal */ }
  }

  if (!isPropertyQuery && !isContinuation) {
    logTerminalSkip({
      platform      : 'DIALOG',
      tag           : '[360DIALOG]',
      agent,
      customerPhone : senderPhone,
      customerName  : senderName,
      ts,
      message       : messageText
    });
    return;
  }

  // ── Generate AI reply (ChatGPT → Claude → Private Agent) ─────────────────
  let aiResult;
  let ctxSource = 'none';

  try {
    const result = await generateWhatsAppAIReply({
      session,
      message  : messageText,
      agentName: agent.name,
    });
    aiResult  = result;
    ctxSource = result.contextSource || 'none';
  } catch (err) {
    const appName = process.env.APP_NAME || 'Elevan Property';
    aiResult = {
      reply         : `Halo ${senderName}, terima kasih menghubungi ${agent.name} dari ${appName}. Kami akan segera membantu mencari properti untuk Anda. 🏠`,
      provider      : 'fallback',
      contextSource : 'none'
    };
    ctxSource = 'none';
  }

  // ── Simpan AI reply ───────────────────────────────────────────────────────
  await saveMessage(session, 'ai', aiResult.reply, {
    aiProvider    : aiResult.provider,
    contextSource : ctxSource
  });

  // ── Kirim reply via 360dialog ─────────────────────────────────────────────
  let dialogSent  = false;
  let dialogError = null;

  try {
    await sendViaDialog(senderPhone, aiResult.reply, agent.dialog360_token);
    dialogSent = true;
    safeLog('DIALOG360_REPLY_SENT', {
      sessionId  : session.id,
      agent      : agent.name,
      recipient  : senderPhone,
      aiProvider : aiResult.provider
    });
  } catch (err) {
    dialogError = err.message;
    safeLog('DIALOG360_SEND_FAILED', { sessionId: session.id, error: err.message }, 'error');
  }

  // ── Log terminal (shared util, format sama dengan Fonnte & WATI) ──────────
  logTerminalSummary({
    platform      : 'DIALOG',
    tag           : '[360DIALOG]',
    agent,
    customerPhone : senderPhone,
    customerName  : senderName,
    ts,
    message       : messageText,
    ctxSource,
    aiProvider    : aiResult.provider,
    aiReply       : aiResult.reply,
    sendStatus    : dialogSent ? '✅ Terkirim' : `❌ Gagal: ${dialogError}`
  });
}

/* ══════════════════════════════════════════════════════════════════════════════
   SECTION 9 — MAIN CONTROLLER CLASS
══════════════════════════════════════════════════════════════════════════════ */

class DialogChatController {

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/dialog-chat/webhook
     ─────────────────────────────────────────────────────────────────────────
     Endpoint utama. Daftarkan URL ini di 360dialog via /setup-webhook.

     Flow:
       1. Terima payload → log raw
       2. detectEventType: incoming | status | unknown
       3. Return 200 DULU ke 360dialog (max latency 80ms sesuai docs)
       4. Proses AI + DB di background (setImmediate)

     Agent identification:
       Header X-Agent-Id di-set saat registerWebhook() dipanggil.
       360dialog meneruskan header ini di setiap webhook request.
  ───────────────────────────────────────────────────────────────────────── */
  static async handleInboundMessage(req, res) {
    const body = req.body || {};

    // ── Log raw payload ───────────────────────────────────────────────────
    console.log('\n╔══════════ 360DIALOG WEBHOOK MASUK ═══════════╗');
    console.log(`║ Time     : ${new Date().toISOString().substring(0, 23).padEnd(33)} ║`);
    console.log(`║ Agent-Id : ${String(req.headers['x-agent-id'] || '(kosong)').substring(0, 33).padEnd(33)} ║`);
    console.log(`║ Keys     : ${String(Object.keys(body).join(', ')).substring(0, 33).padEnd(33)} ║`);
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('[360DIALOG RAW]', JSON.stringify(body).substring(0, 400));

    // ── Detect event type ─────────────────────────────────────────────────
    const eventType = detectEventType(body);
    console.log(`[360DIALOG EVENT] Type: ${eventType}`);

    // ── Status update — log dan return ────────────────────────────────────
    if (eventType === 'status') {
      const s = body.statuses[0] || {};
      logStatusUpdate(s.recipient_id || '-', s.status || '-', s.id || '-');
      return res.status(process.env.HTTP_OK).json({ success: true, type: 'status' });
    }

    // ── Unknown event ─────────────────────────────────────────────────────
    if (eventType !== 'incoming') {
      return res.status(process.env.HTTP_OK).json({ success: true, type: 'unknown' });
    }

    // ── INCOMING MESSAGE — respond 200 DULU, proses di background ────────
    res.status(process.env.HTTP_OK).json({ success: true, type: 'incoming', message: 'Webhook diterima' });

    setImmediate(async () => {
      try {
        // Identifikasi agent via header X-Agent-Id
        const agentId = req.headers['x-agent-id'] || null;
        let agent     = await findAgentByHeaderId(agentId);

        // Fallback: agent pertama yang punya dialog360_token
        if (!agent) {
          const all = await getAllAgentsWithDialog();
          if (all.length > 0) {
            agent = all[0];
            console.log(`[360DIALOG AGENT] Auto-select: ${agent.name}`);
          }
        }

        // Proses setiap pesan dalam payload (biasanya hanya 1)
        const contacts = body.contacts || [];

        for (const msg of (body.messages || [])) {
          await processIncomingMessage(msg, contacts, agent);
        }

      } catch (err) {
        console.error('[360DIALOG BACKGROUND ERROR]', err.message, err.stack);
        safeLog('DIALOG360_BACKGROUND_ERROR', { error: err.message }, 'error');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/dialog-chat/setup-webhook
     ─────────────────────────────────────────────────────────────────────────
     Helper: daftarkan webhook URL ke 360dialog untuk satu agent.

     Body:
     {
       "agentId"    : "LFGKT49002",   ← user_id dari DB
       "webhookUrl" : "https://your-ngrok/api/dialog-chat/webhook"  ← opsional
     }

     Jika webhookUrl tidak diisi, otomatis pakai ngrok/backend URL dari env.
  ───────────────────────────────────────────────────────────────────────── */
  static async setupWebhook(req, res) {
    try {
      const { agentId, webhookUrl } = req.body || {};

      if (!agentId) {
        return res.status(process.env.HTTP_BAD_REQUEST).json({
          success : false,
          message : 'Wajib isi: agentId (user_id agent dari database)'
        });
      }

      // Cari agent di DB
      const agent = await User.findOne({
        where      : { user_id: agentId, privilege: 'agent', status: 1 },
        attributes : ['id', 'user_id', 'name', 'phone', 'dialog360_token']
      });

      if (!agent) {
        return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: `Agent ${agentId} tidak ditemukan` });
      }

      if (!agent.dialog360_token || String(agent.dialog360_token).trim().length < 5) {
        return res.status(process.env.HTTP_BAD_REQUEST).json({
          success : false,
          message : `Agent ${agent.name} belum punya dialog360_token di database`,
          hint    : 'Kirim "START" ke +551146733492 via WA untuk dapat API key sandbox, lalu update DB'
        });
      }

      // Tentukan webhook URL
      const baseServerUrl = process.env.DIALOG360_WEBHOOK_BASE_URL
        || process.env.SERVER_BASE_URL
        || `http://localhost:${process.env.PORT || 5005}`;

      const targetUrl = webhookUrl || `${baseServerUrl}/api/dialog-chat/webhook`;

      console.log(`[360DIALOG SETUP] Mendaftarkan webhook untuk ${agent.name}...`);
      console.log(`[360DIALOG SETUP] URL: ${targetUrl}`);

      const result = await registerWebhook(agent.dialog360_token, agent.user_id, targetUrl);

      console.log(`[360DIALOG SETUP] ✅ Webhook berhasil didaftarkan untuk ${agent.name}`);

      return res.json({
        success    : true,
        message    : `Webhook berhasil didaftarkan untuk ${agent.name}`,
        agent      : agent.name,
        webhookUrl : targetUrl,
        response   : result
      });

    } catch (err) {
      console.error('[360DIALOG SETUP ERROR]', err.message);
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({
        success : false,
        message : 'Gagal mendaftarkan webhook',
        error   : err.response?.data || err.message
      });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/dialog-chat/simulate
     Test pipeline tanpa WA asli
  ───────────────────────────────────────────────────────────────────────── */
  static async simulateInboundMessage(req, res) {
    const {
      sender  = '628999888777',
      message = 'Halo saya mau tanya properti',
      name    = 'Test Customer',
      agentId = null,
      dry_run = false
    } = req.body || {};

    console.log('\n[360DIALOG SIMULATE] 🧪 Simulasi pesan masuk');
    console.log(`  From   : ${sender} (${name})`);
    console.log(`  Message: ${message}`);
    console.log(`  Dry Run: ${dry_run}`);

    // Cari agent
    let agent = agentId ? await findAgentByHeaderId(agentId) : null;
    if (!agent) {
      const all = await getAllAgentsWithDialog();
      if (all.length > 0) agent = all[0];
    }

    if (!agent) {
      return res.status(process.env.HTTP_NOT_FOUND).json({
        success : false,
        message : 'Tidak ada agent dengan dialog360_token. Cek /api/dialog-chat/status'
      });
    }

    if (dry_run) {
      return res.json({ success: true, dry_run: true, agent: agent.name, sender, message });
    }

    // Buat fake payload 360dialog
    const fakeMsg = {
      from      : sender,
      id        : `sim_${Date.now()}`,
      type      : 'text',
      text      : { body: message },
      timestamp : String(Math.floor(Date.now() / 1000))
    };
    const fakeContacts = [{ profile: { name }, wa_id: sender }];

    try {
      await processIncomingMessage(fakeMsg, fakeContacts, agent);
      return res.json({
        success : true,
        message : 'Simulate selesai. Lihat terminal.',
        agent   : agent.name
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     POST /api/dialog-chat/webhook-raw
     Debug endpoint — log semua payload mentah dari 360dialog.
     Sama seperti fonnteChatController.webhookRawCatcher.
  ───────────────────────────────────────────────────────────────────────── */
  static async webhookRawCatcher(req, res) {
    const body    = req.body || {};
    const ts      = new Date().toISOString();
    const agentId = req.headers['x-agent-id'] || '(kosong)';

    console.log('\n╔════════════ 360DIALOG RAW CATCHER ═══════════╗');
    console.log(`║ ${ts.padEnd(45)} ║`);
    console.log(`║ Agent-Id : ${String(agentId).substring(0, 35).padEnd(35)} ║`);
    console.log(`║ Keys     : ${String(Object.keys(body).join(', ')).substring(0, 35).padEnd(35)} ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('[360DIALOG RAW PAYLOAD]', JSON.stringify(body, null, 2));

    const eventType = detectEventType(body);
    console.log('[360DIALOG RAW CATCHER] Detected event:', eventType);

    if (eventType === 'incoming') {
      console.log('[360DIALOG RAW CATCHER] ✅ Ini incoming message → teruskan ke handler...');
      return DialogChatController.handleInboundMessage(req, res);
    }

    return res.status(process.env.HTTP_OK).json({
      status      : true,
      caught      : true,
      eventType,
      agentId,
      payloadKeys : Object.keys(body),
      raw         : body
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/dialog-chat/status
  ───────────────────────────────────────────────────────────────────────── */
  static async getDialogStatus(req, res) {
    try {
      const allAgents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'dialog360_token']
      });

      const ready = allAgents.filter(
        a => a.dialog360_token && String(a.dialog360_token).trim().length > 5
      );

      const mode    = String(process.env.DIALOG360_SANDBOX || 'true').toLowerCase() !== 'false'
        ? 'sandbox' : 'production';
      const baseUrl = getBaseUrl();

      return res.json({
        success : true,
        data    : {
          mode,
          baseUrl,
          total       : allAgents.length,
          dialog_ready: ready.length,
          agents      : allAgents.map(a => ({
            user_id   : a.user_id,
            name      : a.name,
            phone     : a.phone,
            has_token : !!(a.dialog360_token && a.dialog360_token.trim().length > 5),
            ready     : !!(a.phone && a.dialog360_token && a.dialog360_token.trim().length > 5)
          }))
        },
        message: `${ready.length} dari ${allAgents.length} agent siap 360dialog (mode: ${mode})`
      });

    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/dialog-chat/agents
  ───────────────────────────────────────────────────────────────────────── */
  static async getAgentsWithDialog(req, res) {
    try {
      const agents = await getAllAgentsWithDialog();
      return res.json({
        success : true,
        data    : {
          agents: agents.map(a => ({
            user_id : a.user_id,
            name    : a.name,
            phone   : a.phone,
            ready   : true
            // TIDAK return dialog360_token ke client (security)
          })),
          total: agents.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/dialog-chat/agent-chats/:agentName
  ───────────────────────────────────────────────────────────────────────── */
  static async getAgentChats(req, res) {
    try {
      const { agentName }              = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const source   = `dialog360_${agentName.toLowerCase().replace(/\s+/g, '_')}`;
      const sessions = await ChatSession.findAll({
        where  : { source },
        order  : [['updatedAt', 'DESC']],
        limit  : Math.min(parseInt(limit)  || 50, 200),
        offset : parseInt(offset) || 0
      });
      const total = await ChatSession.count({ where: { source } });

      return res.json({
        success: true,
        data   : { agent: agentName, sessions, pagination: { total, limit: parseInt(limit) || 50 } }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/dialog-chat/chat-history/:sessionId
  ───────────────────────────────────────────────────────────────────────── */
  static async getChatHistory(req, res) {
    try {
      const { sessionId }   = req.params;
      const { limit = 100 } = req.query;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return res.status(process.env.HTTP_NOT_FOUND).json({ success: false, message: 'Sesi tidak ditemukan' });

      const messages = await ChatMessage.findAll({
        where : { chatSessionId: sessionId },
        order : [['createdAt', 'ASC']],
        limit : Math.min(parseInt(limit) || 100, 500)
      });

      return res.json({
        success: true,
        data   : {
          session  : { id: session.id, name: session.name, phone: session.phone, source: session.source },
          messages,
          count    : messages.length
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GET /api/dialog-chat/debug-info
     Dilindungi verifyToken di routes.
  ───────────────────────────────────────────────────────────────────────── */
  static async getDebugInfo(req, res) {
    try {
      const allAgents = await User.findAll({
        where      : { privilege: 'agent', status: 1 },
        attributes : ['user_id', 'name', 'phone', 'dialog360_token']
      });

      const mode    = String(process.env.DIALOG360_SANDBOX || 'true').toLowerCase() !== 'false'
        ? 'sandbox' : 'production';

      return res.json({
        success: true,
        data   : {
          server : {
            port       : process.env.PORT || 5005,
            webhookUrl : 'POST /api/dialog-chat/webhook',
            mode
          },
          agents : allAgents.map(a => ({
            user_id          : a.user_id,
            name             : a.name,
            phone_raw        : a.phone,
            phone_normalized : normalizePhone(a.phone || ''),
            has_token        : !!(a.dialog360_token && a.dialog360_token.trim().length > 5),
            ready            : !!(a.phone && a.dialog360_token && a.dialog360_token.trim().length > 5)
            // TIDAK return dialog360_token ke client (security)
          }))
        }
      });
    } catch (err) {
      return res.status(process.env.HTTP_INTERNAL_SERVER_ERROR).json({ success: false, message: err.message });
    }
  }
}

module.exports = DialogChatController;
