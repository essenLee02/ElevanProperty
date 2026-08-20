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

// ─── TRUST PROXY — WAJIB saat di belakang reverse proxy (Hostinger/VPS) ──────
// BUG PRODUKSI (Hostinger, 20 Agu 2026): webhook Kirimi BENAR-BENAR SAMPAI
// ("[⇨ HTTP IN] POST /api/kirimi/webhook"), tapi langsung mati di rate limiter:
//
//   ValidationError: The 'X-Forwarded-For' header is set but the Express
//   'trust proxy' setting is false (default).
//
// Hostinger menaruh aplikasi Node di belakang reverse proxy, jadi SETIAP
// request membawa header X-Forwarded-For. Karena `trust proxy` default false,
// express-rate-limit menolak berjalan (ia tidak bisa menentukan IP asli
// pengirim, sehingga rate limit-nya tidak bisa dipercaya) dan melempar error.
// Akibatnya: pesan WhatsApp dari customer TIDAK PERNAH diproses AI sama sekali.
//
// ⚠️ SENGAJA BUKAN `true`. `trust proxy: true` = percaya BUTA seluruh rantai
// X-Forwarded-For, sehingga siapa pun bisa memalsukan header itu dan LOLOS dari
// rate limit (juga merusak akurasi IP di log). Nilai ANGKA = jumlah proxy hop
// yang dipercaya dari sisi terdekat; 1 hop benar untuk Hostinger/Passenger dan
// mayoritas PaaS. Bila kelak ada Cloudflare DI DEPAN Hostinger, naikkan ke 2
// lewat env — jangan diubah jadi `true`.
//
// Default 1 berlaku untuk KEDUA mode, bukan hanya hosting:
//   NGROK_ENABLE=true  → ngrok JUGA reverse proxy dan ikut mengirim
//                        X-Forwarded-For, jadi tetap 1 hop.
//   NGROK_ENABLE=false → Hostinger/VPS di belakang proxy, 1 hop.
// Akses lokal langsung ke localhost:5055 (tanpa tunnel) tidak mengirim
// X-Forwarded-For sama sekali, sehingga nilai 1 tidak berpengaruh apa pun di
// sana — aman sebagai default tunggal. Set TRUST_PROXY_HOPS=0 hanya bila
// benar-benar tidak ada proxy dan ingin memaksa perilaku Express apa adanya.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
app.set('trust proxy', Number.isFinite(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);

// ⚠️ URUTAN INI PENTING UNTUK HOSTING (Hostinger/Passenger, Railway, Heroku, dll).
// Platform hosting MENYUNTIKKAN port lewat `process.env.PORT` dan mem-proxy
// trafik domain ke port itu. Aplikasi WAJIB mendengarkan port pemberian platform;
// bila kita memaksa port sendiri (5055), proxy menembak port yang tidak ada
// pendengarnya → domain membalas **503 Service Unavailable** walau prosesnya hidup.
//
// APP_PORT tetap dipakai untuk DEV lokal (nama sengaja di-prefix APP_ agar tidak
// bentrok dengan variabel sistem). Jangan balik urutannya.
const port = process.env.PORT || process.env.APP_PORT || 5000;
const frontendPort = process.env.APP_FRONTEND_PORT || 5173;

// CORS dengan credentials supaya cookie refresh_token bisa dibaca frontend.
// DEV: localhost:APP_FRONTEND_PORT. PRODUKSI: domain nyata dari APP_URL —
// tanpa ini, frontend di https://propmatches.fun ditolak CORS meski backend hidup.
const allowedOrigins = [
  `http://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
  `http://0.0.0.0:${frontendPort}`
];

// APP_URL = origin publik aplikasi (mis. https://propmatches.fun).
// Varian www ikut didaftarkan supaya pengunjung yang mengetik www tidak tertolak.
(function registerProductionOrigins() {
  const raw = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (!raw || /^https?:\/\/localhost/i.test(raw)) return;

  const add = (o) => { if (o && !allowedOrigins.includes(o)) allowedOrigins.push(o); };
  add(raw);

  try {
    const u = new URL(raw);
    const host = u.host.replace(/^www\./i, '');
    add(`${u.protocol}//${host}`);
    add(`${u.protocol}//www.${host}`);
  } catch { /* APP_URL bukan URL valid — cukup pakai bentuk mentahnya */ }
}());

// Origin tambahan (opsional, pisah koma) — mis. domain staging atau panel terpisah.
String(process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)
  .forEach((o) => { if (!allowedOrigins.includes(o)) allowedOrigins.push(o); });

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

// ─── Serve gambar properti dari direktori upload ─────────────────────────────
// Path yang sama dengan yang dipakai frontend (`/assets/image_data/...`), supaya
// URL di property_images.url valid BAIK dari origin frontend (Vite public/)
// MAUPUN dari origin backend — dibutuhkan konteks AI/WhatsApp & build produksi.
app.use(
  process.env.PROPERTY_IMAGE_URL_BASE || '/assets/image_data',
  express.static(path.resolve(__dirname, process.env.PROPERTY_IMAGE_DIR || '../frontend/public/assets/image_data'))
);

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
  return res.status(parseInt(process.env.HTTP_OK) || 200).json({
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

  try {
    const usersTable = await queryInterface.describeTable('users');
    if (usersTable && !usersTable.email) {
      await queryInterface.addColumn('users', 'email', {
        type: DataTypes.STRING(200),
        allowNull: true
      });
      console.log('Database migration completed: added users.email column');
    }
    if (usersTable && !usersTable.catalog_summary) {
      await queryInterface.addColumn('users', 'catalog_summary', {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: null
      });
      console.log('Database migration completed: added users.catalog_summary column');
    }

    // ── Preferensi agent: AI provider + jenis transaksi yang dilayani ────────
    // NOT NULL + defaultValue → baris lama otomatis terisi default yang aman
    // (Default/Both/Cash), jadi tidak ada agent yang tiba-tiba kehilangan
    // konfigurasi setelah upgrade.
    const USER_PREF_COLUMNS = [
      ['ai_primary',      { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Default' }],
      ['trans_type',      { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Both' }],
      ['payment_type',    { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Cash' }],
      ['rental_duration', { type: DataTypes.INTEGER,    allowNull: true,  defaultValue: null }],
      ['rental_type',     { type: DataTypes.STRING(30), allowNull: true,  defaultValue: null }],
    ];
    for (const [col, spec] of USER_PREF_COLUMNS) {
      if (usersTable && !usersTable[col]) {
        await queryInterface.addColumn('users', col, spec);
        console.log(`Database migration completed: added users.${col} column`);
      }
    }

    // ⚠️ Default kolom SENDIRI tidak konsisten dengan aturan bisnis: trans_type
    // default "Both" sedangkan payment_type default "Cash", padahal aturannya
    // Both → payment_type WAJIB "Both". Setiap baris yang lahir dari default itu
    // langsung melanggar invariant (terbukti: 6 baris agent di DB produksi).
    //
    // Dijalankan SETIAP BOOT, bukan hanya saat kolom baru dibuat: kolomnya bisa
    // sudah ada lebih dulu (dibuat manual / sync sebelumnya) sehingga baris
    // bermasalah tidak akan pernah tersentuh oleh cek "baru ditambahkan".
    // Idempoten & murah — no-op begitu data sudah konsisten.
    const [bothFixed] = await sequelize.query(
      "UPDATE users SET payment_type = 'Both' WHERE trans_type = 'Both' AND payment_type <> 'Both'"
    );
    const [rentFixed] = await sequelize.query(
      "UPDATE users SET payment_type = 'Cash' WHERE trans_type = 'Rent' AND payment_type <> 'Cash'"
    );
    // Sale boleh Cash/KPR/Both → tidak perlu dinormalisasi.
    const fixedCount = (bothFixed?.affectedRows || 0) + (rentFixed?.affectedRows || 0);
    if (fixedCount > 0) {
      console.log(`Database migration completed: normalised users.payment_type against trans_type (${fixedCount} row(s))`);
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Users schema check warning:', error.message);
    }
  }

  try {
    const chatMessagesTable = await queryInterface.describeTable('chat_messages');
    if (chatMessagesTable && !chatMessagesTable.customer_phone) {
      await queryInterface.addColumn('chat_messages', 'customer_phone', {
        type: DataTypes.STRING(30),
        allowNull: true
      });
      console.log('Database migration completed: added chat_messages.customer_phone column');
    }
    if (chatMessagesTable && !chatMessagesTable.ai_responder) {
      await queryInterface.addColumn('chat_messages', 'ai_responder', {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: null
      });
      console.log('Database migration completed: added chat_messages.ai_responder column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Chat messages schema check warning:', error.message);
    }
  }

  try {
    const customersTable = await queryInterface.describeTable('customers');
    if (customersTable && !customersTable.ask_name) {
      await queryInterface.addColumn('customers', 'ask_name', {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: 'NO',
        after: 'ai_response'
      });
      console.log('Database migration completed: added customers.ask_name column');
    }
  } catch (error) {
    if (!String(error.message || '').toLowerCase().includes('no description found')) {
      console.warn('Customers schema check warning:', error.message);
    }
  }

}

sequelize.sync()
  .then(async () => {
    await ensureRequiredDatabaseColumns();

    // Refresh location keyword cache from cities table so the chatbot keyword
    // filter recognises every city in the DB, not just the static fallback list.
    const { initLocationCache } = require('./utils/propertyKeywordFilter');
    await initLocationCache();

    // Load facility master (bilingual) so detectFacilities recognises every
    // facility registered in the DB, not just the hardcoded Indonesian map.
    const { initFacilityCache, initCityCache, initLandmarkCache } = require('./services/propertyRecommendationService');
    await initFacilityCache();

    // Load city master (cities table) so detectLocation()/getKnownLocations()
    // in propertyRecommendationService.js recognise every active city in the
    // DB, not just the hardcoded FALLBACK_LOCATION_KEYWORDS list.
    await initCityCache();

    // Load landmark master (locations table) so detectLandmark() recognises
    // named landmarks (e.g. Pakuwon Mall, Grand City Mall) and catalog search
    // can filter/prioritize properties tagged to that landmark via property_locations.
    await initLandmarkCache();

    console.log('Database connected and synced');
    console.log('Environment file loaded from:', path.resolve(__dirname, '.env'));
    console.log('OpenAI key configured:', Boolean(process.env.CHAT_GPT_API_KEY));
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

      // ─── URL publik + banner webhook (M117) ───────────────────────────
      // Sumber kebenaran ada di services/publicUrlService.js. Sebelumnya blok
      // ini mencetak "https://<ngrok-url>/api/kirimi/webhook" APA PUN modenya —
      // termasuk di Hostinger yang tidak punya ngrok sama sekali (terlihat di
      // log produksi 19 Agu 2026 14:03). Placeholder itu membuat webhook diisi
      // menebak, dan webhook salah alamat = pesan customer hilang tanpa error.
      const publicUrlSvc = require('./services/publicUrlService');
      const printBanner = (ngrokUrl = '') => {
        for (const line of publicUrlSvc.buildWebhookBanner({ ngrokUrl, port })) {
          console.log(line);
        }
      };

      if (publicUrlSvc.ngrokEnabled()) {
        const { startNgrok } = require('./services/ngrokService');
        console.log('[NGROK] Starting tunnel...');
        startNgrok(port)
          .then((url) => printBanner(url))
          .catch((err) => {
            console.error('[NGROK] Gagal start:', err.message);
            printBanner('');   // banner tetap menjelaskan apa yang kurang
          });
      } else {
        // Mode VPS/Hostinger: URL publik diturunkan dari APP_URL/PUBLIC_URL.
        printBanner('');
      }

      // ─── Warmup Rumah123 cache ─────────────────────────────────────────
      // Hormati RUMAH123_DATA=OFF juga di sini — sebelumnya hanya cek token
      // Apify tersedia, jadi warmup tetap jalan (membakar kuota Apify) meski
      // fitur live-fetch sudah dimatikan lewat toggle. Konsisten dengan gate
      // yang sama di whatsappPropertyContext.js.
      const { isRumah123EnabledForAI, warmupCache } = require('./services/rumah123ContextService');
      const rumah123Enabled = isRumah123EnabledForAI();
      if (rumah123Enabled && process.env.APIFY_API_TOKEN && process.env.APIFY_API_TOKEN !== 'isi_apify_token_anda') {
        const warmupLocations = (process.env.RUMAH123_WARMUP_LOCATIONS || 'Jakarta Selatan,Surabaya,Bandung,Bali').split(',').map(s => s.trim());
        setTimeout(() => {
          console.log('[Rumah123] Starting background cache warmup...');
          warmupCache(warmupLocations);
        }, 5000); // delay 5s after server start
      } else if (!rumah123Enabled) {
        console.log('[Rumah123] RUMAH123_DATA=OFF → skip cache warmup (hemat kuota Apify)');
      }
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });

// Matikan ngrok child process saat backend di-stop (Ctrl+C / nodemon restart)
// agar tidak ada proses ngrok orphan yang tetap jalan di background.
function shutdownNgrok() {
  try {
    const { stopNgrok } = require('./services/ngrokService');
    stopNgrok();
  } catch {
    // ngrokService belum pernah dipakai — abaikan
  }
}
process.on('SIGINT', () => { shutdownNgrok(); process.exit(0); });
process.on('SIGTERM', () => { shutdownNgrok(); process.exit(0); });
