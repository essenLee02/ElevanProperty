/**
 * sync-db.js
 * Synchronize Sequelize models dengan database schema
 *
 * Usage: node scripts/sync-db.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
const User = require('../models/User');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Contact = require('../models/Contact');
const Property = require('../models/Property');
const WhatsAppInbound = require('../models/WhatsAppInbound');
const Log = require('../models/Log');

const syncDatabase = async () => {
  try {
    console.log('[DB SYNC] Starting database synchronization...');

    // Option 1: alter: true = menambah kolom baru, tapi tidak hapus kolom lama
    await sequelize.sync({ alter: true });

    console.log('[DB SYNC] ✅ Database synchronized successfully!');
    console.log('[DB SYNC] Kolom fonnte_token sudah ditambahkan ke tabel users');

    process.exit(0);
  } catch (error) {
    console.error('[DB SYNC ERROR]', error.message);
    process.exit(1);
  }
};

syncDatabase();
