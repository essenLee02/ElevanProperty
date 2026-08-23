/**
 * certificateAndLocationTypeModel.test.js — regresi M129.
 *
 * Permintaan pemilik proyek: sertifikat properti berbeda aturan antara sewa
 * dan beli (SHM/SHGB/SHSRS hanya untuk beli), dan `locations` perlu
 * membedakan AREA (Citraland, Wiyung — kawasan identitas properti), LANDMARK
 * (Taman Bungkul, Kebun Binatang — patokan lokasi publik), dan COMMERCIAL
 * (RS, Indomaret, sekolah — fasilitas sekitar, biasanya generik lintas kota).
 *
 * Run: node tests/certificateAndLocationTypeModel.test.js
 */
'use strict';

require('dotenv').config();
const Property = require('../models/Property');
const Location = require('../models/Location');

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

async function rejects(promise) {
  try { await promise; return false; } catch (_) { return true; }
}

async function main() {
  console.log('\n== Property.CERTIFICATE_TYPES_BY_TX — konstanta terekspos ==');
  {
    ok('rent hanya KOSONG/LAINNYA', JSON.stringify(Property.CERTIFICATE_TYPES_BY_TX.rent) === JSON.stringify(['KOSONG', 'LAINNYA']));
    ok('sale termasuk SHM/SHGB/SHSRS', ['SHM', 'SHGB', 'SHSRS'].every(c => Property.CERTIFICATE_TYPES_BY_TX.sale.includes(c)));
  }

  console.log('\n== Property validate() — certificate_type vs transaction_type ==');
  {
    ok('rent + SHM DITOLAK', await rejects(Property.build({ transaction_type: 'rent', certificate_type: 'SHM' }).validate({ fields: ['certificate_type'] })));
    ok('rent + SHGB DITOLAK', await rejects(Property.build({ transaction_type: 'rent', certificate_type: 'SHGB' }).validate({ fields: ['certificate_type'] })));
    ok('rent + KOSONG DITERIMA', !(await rejects(Property.build({ transaction_type: 'rent', certificate_type: 'KOSONG' }).validate({ fields: ['certificate_type'] }))));
    ok('rent + LAINNYA DITERIMA', !(await rejects(Property.build({ transaction_type: 'rent', certificate_type: 'LAINNYA' }).validate({ fields: ['certificate_type'] }))));
    ok('sale + SHM DITERIMA', !(await rejects(Property.build({ transaction_type: 'sale', certificate_type: 'SHM' }).validate({ fields: ['certificate_type'] }))));
    ok('sale + SHGB DITERIMA', !(await rejects(Property.build({ transaction_type: 'sale', certificate_type: 'SHGB' }).validate({ fields: ['certificate_type'] }))));
    ok('sale + SHSRS DITERIMA', !(await rejects(Property.build({ transaction_type: 'sale', certificate_type: 'SHSRS' }).validate({ fields: ['certificate_type'] }))));
    ok('null SELALU diterima di kedua transaksi',
      !(await rejects(Property.build({ transaction_type: 'rent', certificate_type: null }).validate({ fields: ['certificate_type'] })))
      && !(await rejects(Property.build({ transaction_type: 'sale', certificate_type: null }).validate({ fields: ['certificate_type'] }))));
    ok('huruf kecil "shm" tetap dikenali (case-insensitive)',
      !(await rejects(Property.build({ transaction_type: 'sale', certificate_type: 'shm' }).validate({ fields: ['certificate_type'] }))));
  }

  console.log('\n== Location.LOCATION_TYPES — konstanta terekspos ==');
  {
    ok('tiga kategori: area, landmark, commercial', JSON.stringify(Location.LOCATION_TYPES) === JSON.stringify(['area', 'landmark', 'commercial']));
  }

  console.log('\n== Location validate() — area wajib city_id ==');
  {
    ok('area TANPA city_id DITOLAK',
      await rejects(Location.build({ name: 'Citraland', location_type: 'area', city_id: null }).validate({ fields: ['location_type', 'city_id'] })));
    ok('area DENGAN city_id DITERIMA',
      !(await rejects(Location.build({ name: 'Citraland', location_type: 'area', city_id: 'CT001' }).validate({ fields: ['location_type', 'city_id'] }))));
    ok('landmark TANPA city_id DITERIMA (generik lintas kota)',
      !(await rejects(Location.build({ name: 'Taman Kota', location_type: 'landmark', city_id: null }).validate({ fields: ['location_type', 'city_id'] }))));
    ok('commercial TANPA city_id DITERIMA (generik, mis. Indomaret)',
      !(await rejects(Location.build({ name: 'Indomaret', location_type: 'commercial', city_id: null }).validate({ fields: ['location_type', 'city_id'] }))));
    ok('location_type tidak dikenal DITOLAK',
      await rejects(Location.build({ name: 'X', location_type: 'random_bukan_kategori', city_id: null }).validate({ fields: ['location_type', 'city_id'] })));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ' ALL PASS'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
