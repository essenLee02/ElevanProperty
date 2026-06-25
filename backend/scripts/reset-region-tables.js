/**
 * reset-region-tables.js
 *
 * One-off: DROP & recreate the region master tables (countries, provinces, cities)
 * after the PK/FK column rename (id_country→country_id, id_province→province_id,
 * id_city→city_id).
 *
 * Tabel-tabel ini baru & belum punya data nyata, jadi aman di-drop. Sequelize
 * sync({ alter:true }) tidak bisa me-rename kolom PK lama → harus drop dulu.
 *
 * Usage: node scripts/reset-region-tables.js
 */

require('dotenv').config();
const sequelize = require('../config/database');
require('../models'); // daftarkan semua model + asosiasi

const { Country, Province, City } = require('../models');

(async () => {
  try {
    console.log('[RESET REGION] Dropping stale tables (cities, provinces, countries)...');

    // Matikan FK check sementara agar drop aman dalam urutan apa pun.
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.query('DROP TABLE IF EXISTS `cities`');
    await sequelize.query('DROP TABLE IF EXISTS `provinces`');
    await sequelize.query('DROP TABLE IF EXISTS `countries`');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('[RESET REGION] Recreating tables from current models...');
    // force:false + sync per-model → CREATE TABLE fresh dengan kolom *_id baru.
    await Country.sync();
    await Province.sync();
    await City.sync();

    console.log('[RESET REGION] ✅ countries / provinces / cities recreated with country_id / province_id / city_id');
    process.exit(0);
  } catch (error) {
    console.error('[RESET REGION ERROR]', error.message);
    process.exit(1);
  }
})();
