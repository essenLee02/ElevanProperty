const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');
require('./models');
const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;
const frontendPort = process.env.FRONTEND_PORT || 5173;

// CORS dengan credentials supaya cookie refresh_token bisa dibaca frontend
// Hanya izinkan origin dari localhost:FRONTEND_PORT dan 127.0.0.1:FRONTEND_PORT
const allowedOrigins = [
  `http://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
  `http://0.0.0.0:${frontendPort}`
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow no-origin (Postman, curl, mobile) tanpa origin header
    if (!origin) return callback(null, true);

    // Check apakah origin ada di whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject jika origin tidak diizinkan
    console.warn(`⚠️  CORS REJECTED: Origin '${origin}' not allowed. Allowed: ${allowedOrigins.join(', ')}`);
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── UNIVERSAL ENTRY LOGGER ──────────────────────────────────────────────────
// Cetak SETIAP request HTTP yang menyentuh backend (method + path), tanpa peduli
// platform atau path. Tujuannya: saat customer chat agent, kita bisa langsung
// LIHAT apakah webhook benar-benar SAMPAI ke server. Jika baris ini TIDAK muncul
// saat customer kirim pesan → request belum sampai (masalah di Kirimi/ngrok/URL),
// BUKAN di controller. Hanya POST yang ditampilkan agar tidak bising oleh GET API.
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const keys = req.body && typeof req.body === 'object' ? Object.keys(req.body).join(',') : '';
    console.log(`\n[⇨ HTTP IN] ${req.method} ${req.path}  | body-keys: ${keys.substring(0, 80) || '(kosong)'}`);
  }
  next();
});

app.get('/', (req, res) => {
  const appName = process.env.APP_NAME || 'Elevan Property';
  res.json({ success: true, message: `${appName} backend is running.` });
});

// ─── Serve JSON data files from backend/asset/json_data/ ─────────────────────
// Sumber tunggal (single source of truth) untuk semua JSON catalog properti.
// Frontend dan backend sama-sama menggunakan file ini via path /json_data/...
app.use('/json_data', express.static(path.join(__dirname, 'asset/json_data')));

// ─── Root POST handler — untuk webhook platform yang tidak menyertakan path ──
// Fonnte / TimelinesAI kadang dikonfigurasi hanya ke base URL (tanpa /api/...)
// Handler ini meneruskan ke controller yang aktif sesuai MASSEGE_TERMINAL di .env
//
// Contoh: Fonnte Dashboard webhook = https://ngrok-url/  (tanpa path)
//         → POST / masuk sini → diteruskan ke fonnteChatController
app.post('/', (req, res) => {
  const active = String(process.env.MASSEGE_TERMINAL || 'FONNTE')
    .toUpperCase().split(',')[0].trim();

  console.log(`\n[ROOT WEBHOOK] POST / diterima — routing ke: ${active}`);
  console.log(`[ROOT WEBHOOK] MASSEGE_TERMINAL = ${process.env.MASSEGE_TERMINAL || '(tidak di-set, default: FONNTE)'}`);

  if (active === 'FONNTE') {
    const FonnteChatController = require('./controllers/fonnteChatController');
    return FonnteChatController.handleInboundMessage(req, res);
  }

  if (active === 'TIMELINESAI') {
    const TimelinesAIChatController = require('./controllers/timelinesAIChatController');
    return TimelinesAIChatController.handleInboundMessage(req, res);
  }

  if (active === 'KIRIMI') {
    const KirimiChatController = require('./controllers/kirimiChatController');
    return KirimiChatController.handleInboundMessage(req, res);
  }

  // Fallback jika MASSEGE_TERMINAL tidak dikenali
  return res.status(process.env.HTTP_OK).json({
    success : true,
    message : 'Webhook diterima. Set MASSEGE_TERMINAL=FONNTE|TIMELINESAI|KIRIMI di .env untuk routing.'
  });
});

// ─── Raw webhook logger (khusus untuk debug Fonnte/TimelinesAI webhook) ─────
// Catat SEMUA request yang masuk ke /api/fonnte-chat/webhook dan /api/timelinesai/webhook
// Hapus atau nonaktifkan middleware ini di production jika tidak dibutuhkan
app.use((req, res, next) => {
  const webhookPaths = [
    '/',
    '/api/fonnte-chat/webhook',
    '/api/fonnte/webhook',
    '/api/timelinesai/webhook',
    '/api/whatsapp/webhook',
    '/api/kirimi/webhook'
  ];
  if (webhookPaths.includes(req.path) && req.method === 'POST') {
    const contentType  = req.headers['content-type'] || '(no content-type)';
    const forwarded    = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || 'unknown';
    const userAgent    = req.headers['user-agent'] || '(no user-agent)';

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║         INCOMING WEBHOOK REQUEST DETECTED                ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ Path        : ${req.path.padEnd(43)} ║`);
    console.log(`║ Method      : ${req.method.padEnd(43)} ║`);
    console.log(`║ IP/Forward  : ${String(forwarded).substring(0, 43).padEnd(43)} ║`);
    console.log(`║ Content-Type: ${String(contentType).substring(0, 43).padEnd(43)} ║`);
    console.log(`║ User-Agent  : ${String(userAgent).substring(0, 43).padEnd(43)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
  }
  next();
});

app.use('/api', routes);

async function ensureRequiredDatabaseColumns() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const logsTable = await queryInterface.describeTable('logs');
    if (logsTable && !logsTable.level) {
      await queryInterface.addColumn('logs', 'level', {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'info'
      });
      console.log('Database migration completed: added logs.level column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Database schema check warning:', error.message);
    }
  }

  try {
    const chatSessionsTable = await queryInterface.describeTable('chat_sessions');
    if (chatSessionsTable && !chatSessionsTable.location) {
      await queryInterface.addColumn('chat_sessions', 'location', {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log('Database migration completed: added chat_sessions.location column');
    }
    if (chatSessionsTable && !chatSessionsTable.normalizedLocation) {
      await queryInterface.addColumn('chat_sessions', 'normalizedLocation', {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log('Database migration completed: added chat_sessions.normalizedLocation column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Chat session schema check warning:', error.message);
    }
  }

}

sequelize.sync()
  .then(async () => {
    await ensureRequiredDatabaseColumns();
    console.log('Database connected and synced');
    console.log('Environment file loaded from:', path.resolve(__dirname, '.env'));
    console.log('OpenAI key configured:', Boolean(process.env.OPENAI_API_KEY));
    console.log('Apify token configured:', Boolean(process.env.APIFY_API_TOKEN) && process.env.APIFY_API_TOKEN !== 'isi_apify_token_anda');
    app.listen(port, () => {
      console.log(`Backend listening at http://localhost:${port}`);
      console.log(`CORS Allowed Origins: ${allowedOrigins.join(', ')}`);

      // ─── Auto-start Fonnte Message Poller ─────────────────────────────
      // Hanya aktif jika MASSEGE_TERMINAL mengandung FONNTE.
      // Jika aktif platform lain (KIRIMI / TIMELINESAI), poller tidak diperlukan.
      const activeTerminals = String(process.env.MASSEGE_TERMINAL || 'FONNTE').toUpperCase().split(',').map(s => s.trim());
      const fonnteIsActive  = activeTerminals.includes('FONNTE');
      const pollingEnabled  = fonnteIsActive && String(process.env.FONNTE_POLLING_ENABLED || 'true').toLowerCase() !== 'false';
      const pollingInterval = parseInt(process.env.FONNTE_POLLING_INTERVAL_MS || '10000');

      if (pollingEnabled) {
        setTimeout(async () => {
          try {
            const FonnteChatCtrl = require('./controllers/fonnteChatController');
            await FonnteChatCtrl.poller.start(pollingInterval);
            console.log(`[FONNTE POLLER] ✅ Auto-started (interval: ${pollingInterval / 1000}s)`);
          } catch (pollErr) {
            console.error('[FONNTE POLLER] ❌ Gagal auto-start:', pollErr.message);
          }
        }, 3000); // delay 3s agar DB connection stabil dulu
      } else if (!fonnteIsActive) {
        console.log(`[FONNTE POLLER] ℹ️  Skip — MASSEGE_TERMINAL=${process.env.MASSEGE_TERMINAL || 'FONNTE'} (bukan FONNTE)`);
      } else {
        console.log('[FONNTE POLLER] ℹ️  Dinonaktifkan via FONNTE_POLLING_ENABLED=false');
      }

      // ─── Kirimi startup hint ───────────────────────────────────────────
      if (activeTerminals.includes('KIRIMI')) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  KIRIMI ACTIVE — set webhook URL di Kirimi Dashboard:        ║');
        console.log(`║  https://<ngrok-url>/api/kirimi/webhook                      ║`);
        console.log(`║  (Server port: ${String(port).padEnd(46)}║`);
        console.log('║  Device webhook: Kirimi Dashboard → Device → Detail          ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
      }

      // ─── Warmup Rumah123 cache ─────────────────────────────────────────
      if (process.env.APIFY_API_TOKEN && process.env.APIFY_API_TOKEN !== 'isi_apify_token_anda') {
        const { warmupCache } = require('./services/rumah123ContextService');
        const warmupLocations = (process.env.RUMAH123_WARMUP_LOCATIONS || 'Jakarta Selatan,Surabaya,Bandung,Bali').split(',').map(s => s.trim());
        setTimeout(() => {
          console.log('[Rumah123] Starting background cache warmup...');
          warmupCache(warmupLocations);
        }, 5000); // delay 5s after server start
      }
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });
