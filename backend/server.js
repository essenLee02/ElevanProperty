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

app.get('/', (req, res) => {
  const appName = process.env.APP_NAME || 'Elevan Property';
  res.json({ success: true, message: `${appName} backend is running.` });
});

// ─── Serve JSON data files from backend/asset/json_data/ ─────────────────────
// Sumber tunggal (single source of truth) untuk semua JSON catalog properti.
// Frontend dan backend sama-sama menggunakan file ini via path /json_data/...
app.use('/json_data', express.static(path.join(__dirname, 'asset/json_data')));

// ─── Root POST handler — untuk webhook platform yang tidak menyertakan path ──
// Fonnte / Dialog / WATI kadang dikonfigurasi hanya ke base URL (tanpa /api/...)
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

  if (active === 'DIALOG') {
    const DialogChatController = require('./controllers/dialogChatController');
    return DialogChatController.handleInboundMessage(req, res);
  }

  if (active === 'WATI') {
    const WatiChatController = require('./controllers/watiChatController');
    return WatiChatController.handleInboundMessage(req, res);
  }

  if (active === 'CHAKRAHQ') {
    const ChakraHQController = require('./controllers/chakraHQController');
    return ChakraHQController.handleInboundMessage(req, res);
  }

  // Fallback jika MASSEGE_TERMINAL tidak dikenali
  return res.status(process.env.HTTP_OK).json({
    success : true,
    message : 'Webhook diterima. Set MASSEGE_TERMINAL=FONNTE|DIALOG|WATI|CHAKRAHQ di .env untuk routing.'
  });
});

// ─── Raw webhook logger (khusus untuk debug Fonnte/WATI webhook) ────────────
// Catat SEMUA request yang masuk ke /api/fonnte-chat/webhook dan /api/wati/webhook
// Hapus atau nonaktifkan middleware ini di production jika tidak dibutuhkan
app.use((req, res, next) => {
  const webhookPaths = [
    '/',
    '/api/fonnte-chat/webhook',
    '/api/fonnte/webhook',
    '/api/wati/webhook',
    '/api/whatsapp/webhook',
    '/api/chakrahq/webhook'
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

  // ─── Tambah kolom dialog360_token ke tabel users (jika belum ada) ──────
  try {
    const usersTable = await queryInterface.describeTable('users');
    if (usersTable && !usersTable.dialog360_token) {
      await queryInterface.addColumn('users', 'dialog360_token', {
        type     : DataTypes.STRING(200),
        allowNull: true,
        after    : 'fonnte_token'
      });
      console.log('Database migration completed: added users.dialog360_token column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Users schema check warning (dialog360_token):', error.message);
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
      // Polling aktif mengambil pesan masuk dari Fonnte API karena
      // "Webhook ?" Fonnte tidak selalu fire untuk incoming messages.
      const pollingEnabled  = String(process.env.FONNTE_POLLING_ENABLED  || 'true').toLowerCase() !== 'false';
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
      } else {
        console.log('[FONNTE POLLER] ℹ️  Dinonaktifkan via FONNTE_POLLING_ENABLED=false');
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
