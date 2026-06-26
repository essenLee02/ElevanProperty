/**
 * drop-dialog360-column.js
 *
 * One-off migration: hapus kolom dialog360_token dari tabel users.
 * Kolom ini tidak lagi ada di model User.js karena 360dialog dihapus dari MVP.
 *
 * Usage: node scripts/drop-dialog360-column.js
 */

'use strict';

require('dotenv').config();
const sequelize = require('../config/database');

async function run() {
  const qi = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();
    console.log('[DB] Connected');

    const cols = await qi.describeTable('users');

    if (!cols.dialog360_token) {
      console.log('[DB] Kolom dialog360_token tidak ditemukan — sudah bersih, tidak ada yang perlu dilakukan.');
      return;
    }

    await qi.removeColumn('users', 'dialog360_token');
    console.log('[DB] ✅ Kolom dialog360_token berhasil dihapus dari tabel users.');

    // Verifikasi
    const after = await qi.describeTable('users');
    const cols360 = Object.keys(after).filter(c => c.includes('dialog') || c.includes('360'));
    if (cols360.length === 0) {
      console.log('[DB] ✅ Verifikasi: tidak ada kolom terkait 360dialog yang tersisa.');
    } else {
      console.warn('[DB] ⚠️  Masih ada kolom terkait:', cols360);
    }

    console.log('[DB] Kolom users saat ini:', Object.keys(after).join(', '));

  } catch (err) {
    console.error('[DB] ❌ Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
