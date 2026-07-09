/**
 * sync-db.js
 * Synchronize Sequelize models dengan database schema
 *
 * Usage: node scripts/sync-db.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
// Load the models barrel so EVERY model registers on the sequelize instance
// (User, ChatSession, ChatMessage, Contact, Property, Log,
//  Facility, Country, Province, City, Location) — otherwise sync() skips unloaded models.
require('../models');

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
