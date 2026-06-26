/**
 * migrate-chakra-to-kirimi.js
 *
 * One-off migration tabel `users`:
 *   1. Tambah kolom kirimi_device_id (mis. "D-3OCA6") jika belum ada.
 *   2. Hapus kolom chakra_hq_token (ChakraHQ tidak lagi dipakai di MVP).
 *   3. Sinkronkan SEMUA kolom users sesuai model User.js (sync alter).
 *
 * Aman dijalankan berulang (idempotent).
 *
 * Usage: node scripts/migrate-chakra-to-kirimi.js
 */

'use strict';

require('dotenv').config();
const sequelize = require('../config/database');
require('../models'); // daftarkan semua model (termasuk User) ke instance sequelize

async function run() {
  const qi = sequelize.getQueryInterface();

  try {
    await sequelize.authenticate();
    console.log('[DB] Connected');

    const before = await qi.describeTable('users');

    // ── 1. Tambah kirimi_device_id jika belum ada ─────────────────────────
    if (!before.kirimi_device_id) {
      await qi.addColumn('users', 'kirimi_device_id', {
        type     : sequelize.Sequelize.STRING(50),
        allowNull: true,
        defaultValue: null,
        after    : 'fonnte_token'
      });
      console.log('[DB] ✅ Kolom kirimi_device_id ditambahkan.');
    } else {
      console.log('[DB] ℹ️  Kolom kirimi_device_id sudah ada — skip.');
    }

    // ── 2. Hapus chakra_hq_token jika masih ada ──────────────────────────
    const mid = await qi.describeTable('users');
    if (mid.chakra_hq_token) {
      await qi.removeColumn('users', 'chakra_hq_token');
      console.log('[DB] ✅ Kolom chakra_hq_token dihapus.');
    } else {
      console.log('[DB] ℹ️  Kolom chakra_hq_token tidak ada — sudah bersih.');
    }

    // ── 3. Sinkronkan semua kolom users sesuai model (alter) ─────────────
    const { User } = require('../models');
    await User.sync({ alter: true });
    console.log('[DB] ✅ Tabel users disinkronkan dengan model (alter).');

    // ── Verifikasi ────────────────────────────────────────────────────────
    const after = await qi.describeTable('users');
    const cols  = Object.keys(after);
    console.log('');
    console.log('[DB] Kolom users sekarang:', cols.join(', '));
    console.log('[DB] kirimi_device_id ada :', !!after.kirimi_device_id);
    console.log('[DB] chakra_hq_token ada  :', !!after.chakra_hq_token);

    if (after.kirimi_device_id && !after.chakra_hq_token) {
      console.log('\n[DB] ✅ Migrasi sukses: kirimi_device_id aktif, chakra_hq_token sudah dihapus.');
    } else {
      console.warn('\n[DB] ⚠️  Verifikasi belum sesuai harapan — cek output di atas.');
    }

  } catch (err) {
    console.error('[DB] ❌ Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
