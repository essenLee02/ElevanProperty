'use strict';
/**
 * repair-locations-id.js
 * ---------------------------------------------------------------------------
 * Memperbaiki 379 baris `locations` yang ber-`id = 0`.
 *
 * PENYEBAB
 *   Tabel `locations` dideklarasikan `id int(11) NOT NULL` TANPA AUTO_INCREMENT.
 *   `scripts/seed-locations-landmarks.js` (13 Agu 2026) menyisipkan 374 landmark
 *   tanpa menyebut kolom `id`, sehingga MySQL mengisinya 0 — semuanya.
 *   Hasil: 589 baris, hanya 211 nilai `id` unik.
 *
 * KENAPA PERLU DIPERBAIKI
 *   `location_id` (kunci bisnis) tetap unik, jadi chatbot & Q6 TIDAK terganggu.
 *   Tapi `id` dipakai sebagai identitas baris oleh ORM mana pun:
 *   SQLAlchemy meruntuhkan 589 baris menjadi 211 lewat identity map, sehingga
 *   ratusan landmark INVISIBLE bagi backend Python — dan pengecekan duplikat
 *   ikut buta terhadapnya (terbukti 14 Agu: dua baris bernama sama lolos).
 *   Sequelize tidak menampakkannya karena mengalamatkan record lewat
 *   `location_id`, jadi cacat ini diam sampai ada pembaca kedua.
 *
 * SIFAT
 *   Hanya MENGISI kolom `id` yang bernilai 0 dengan angka unik berurutan di
 *   atas nilai maksimum yang ada. TIDAK menyentuh location_id/name/status —
 *   tidak ada baris yang dihapus, diubah namanya, atau berpindah status.
 *
 * Jalankan:
 *   node backend/scripts/repair-locations-id.js --dry   # pratinjau (default aman)
 *   node backend/scripts/repair-locations-id.js         # terapkan
 */

require('dotenv').config();
const { Op } = require('sequelize');
const { Location } = require('../models');
const sequelize = require('../config/database');

const DRY = process.argv.includes('--dry');

(async () => {
  console.log(DRY ? '=== DRY RUN (tidak menulis) ===' : '=== PERBAIKAN id locations ===');
  try {
    const total = await Location.count();
    const [[{ maxId }]] = await sequelize.query(
      'SELECT COALESCE(MAX(id), 0) AS maxId FROM locations'
    );
    const broken = await Location.findAll({
      where: { id: 0 },
      attributes: ['location_id', 'name'],
      order: [['location_id', 'ASC']],
      raw: true,
    });

    console.log(`  total baris   : ${total}`);
    console.log(`  id maksimum   : ${maxId}`);
    console.log(`  baris id=0    : ${broken.length}`);

    if (!broken.length) {
      console.log('  ✅ Tidak ada yang perlu diperbaiki.');
      process.exit(0);
    }

    console.log(`  akan diberi id: ${Number(maxId) + 1} .. ${Number(maxId) + broken.length}`);
    console.log('  contoh:', broken.slice(0, 5).map((b) => b.name).join(' · '));

    if (DRY) {
      console.log('\n(dry run — tidak ada perubahan)');
      process.exit(0);
    }

    let next = Number(maxId) + 1;
    let fixed = 0;
    for (const row of broken) {
      // UPDATE ditarget lewat location_id (kunci bisnis yang unik) — TIDAK
      // lewat id, yang justru sedang rusak.
      await sequelize.query(
        'UPDATE locations SET id = :newId WHERE location_id = :lid AND id = 0',
        { replacements: { newId: next, lid: row.location_id } }
      );
      next += 1;
      fixed += 1;
    }

    const [[{ distinctId }]] = await sequelize.query(
      'SELECT COUNT(DISTINCT id) AS distinctId FROM locations'
    );
    const after = await Location.count();

    console.log(`\n  ✅ diperbaiki : ${fixed}`);
    console.log(`  total baris   : ${after}`);
    console.log(`  id unik       : ${distinctId} ${Number(distinctId) === after ? '(SEHAT)' : '(MASIH BERTABRAKAN)'}`);
    process.exit(Number(distinctId) === after ? 0 : 1);
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  }
})();
