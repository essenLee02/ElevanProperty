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

      // Warmup Rumah123 cache in background after server starts
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
