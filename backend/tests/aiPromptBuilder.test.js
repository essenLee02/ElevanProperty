/**
 * Test: aiPromptBuilderService findNextQuestion + type/tx detection
 * Run: node backend/tests/aiPromptBuilder.test.js
 */

// ─── Inline the helpers we need to test ───────────────────────────────────────

function _typeKeyFromWord(word = '') {
  const w = word.toLowerCase().trim();
  if (/kondotel|condotel/.test(w))               return 'kondotel';
  if (/mansion|rumah\s*mewah/.test(w))           return 'mansion';
  if (/vill?a/.test(w))                          return 'villa';
  if (/apartemen|apartment/.test(w))             return 'apartment';
  if (/hotel|penginapan/.test(w))                return 'hotel';
  if (/kos|kost|kosan|indekos/.test(w))          return 'boarding_house';
  if (/ruko|rukan|shophouse/.test(w))            return 'shophouse';
  if (/toko|kios|warung|retail/.test(w))         return 'store';
  if (/kantor|office/.test(w))                   return 'office';
  if (/gudang|warehouse/.test(w))                return 'warehouse';
  if (/rumah|house|kontrakan/.test(w))           return 'house';
  if (/tanah|kavling|lahan|spbu|pabrik/.test(w)) return 'others';
  return null;
}

function typeOfP0(txt) {
  const w = (txt || '').toLowerCase();
  if (/\bkondotel\b|\bcondotel\b/.test(w))                             return 'kondotel';
  if (/\bmansion\b|\brumah\s+mewah\b/.test(w))                        return 'mansion';
  if (/\bvill?a\b/.test(w))                                            return 'villa';
  if (/\bapartemen\b|\bapartment\b/.test(w))                           return 'apartment';
  if (/\bhotel\b|\bpenginapan\b/.test(w))                             return 'hotel';
  if (/\bkos\b|\bkost\b|\bkosan\b|\bindekos\b/.test(w))              return 'boarding_house';
  if (/\bruko\b|\brukan\b/.test(w))                                   return 'shophouse';
  if (/\btoko\b|\bkios\b|\bwarung\b|\bretail\b/.test(w))             return 'store';
  if (/\bkantor\b/.test(w))                                           return 'office';
  if (/\bgudang\b/.test(w))                                           return 'warehouse';
  if (/\brumah\b|\bhouse\b|\bkontrakan\b/.test(w))                   return 'house';
  if (/\btanah\b|\bkavling\b|\blahan\b|\bspbu\b|\bpabrik\b/.test(w)) return 'others';
  return null;
}

function txOfP0(txt) {
  const w = (txt || '').toLowerCase();
  if (/\b(sewa|menyewa|penyewaan|disewa|disewakan|kontrak|ngontrak|rent|rental|lease|booking|book|pesan|reservasi)\b/.test(w))
    return 'rent';
  if (/\b(beli|membeli|pembelian|dibeli|jual|dijual|buy|purchase|invest|investasi)\b/.test(w))
    return 'sale';
  return null;
}

function findNextQuestion(state) {
  const tx   = (state.transactionType || '').toLowerCase();
  const type = (state.buildingType    || '').toLowerCase();
  const loc  = state.location ? `*${state.location}*` : '*[area]*';
  const typeLbl = state.buildingType || '[tipe]';
  const isSewa  = tx.includes('sewa') || tx === 'rent';
  const isApt   = type === 'apartment';
  const isBooking   = (type === 'hotel' || type === 'kondotel') && isSewa;
  const isCommercial = ['shophouse', 'office', 'warehouse', 'store'].includes(type);
  const isLuxury = type === 'mansion';

  if (!state.buildingType) return { q: 'Q1', hint: 'Tipe properti apa yang dicari?' };
  if (!state.transactionType) return { q: 'Q1', hint: 'Sewa atau beli?' };

  if (!state.location) {
    if (isBooking)          return { q: 'Q2', hint: `Booking ${typeLbl} — di kota mana?` };
    if (type === 'villa' && isSewa) return { q: 'Q2', hint: 'Mau sewa Villa — di mana?' };
    return { q: 'Q2', hint: `${tx} ${typeLbl} — di kota mana?` };
  }

  if (!state.searchHistory && !isBooking) return { q: 'Q2b', hint: 'Sudah lihat berapa properti di area ini?' };

  if (!state.budget) return { q: 'Q3', hint: 'Budget kisaran berapa?' };
  if (!state.household && !isCommercial && !isBooking) return { q: 'Q4', hint: 'Untuk berapa orang / KK?' };

  if (isSewa && !isBooking && !state.leaseDuration) return { q: 'Q10', hint: 'Sewa berapa lama?' };
  if (isSewa && !isCommercial && !isBooking && type !== 'villa' && type !== 'mansion' && !state.furnishing)
    return { q: 'Q11', hint: 'Furnished / semi / kosong?' };

  if (isApt && !state.apartmentPref) return { q: 'Q12', hint: 'Preferensi tower/lantai?' };

  if (isBooking)   return { q: 'Q14', hint: `Q14 ${typeLbl} booking: check-out, tipe kamar, breakfast?` };
  if (type === 'villa' && isSewa)  return { q: 'Q14', hint: 'Q14 villa sewa: malam/minggu/bulan, private pool, check-in?' };
  if (type === 'villa' && !isSewa) return { q: 'Q14', hint: 'Q14 villa beli: private pool, freehold/leasehold?' };
  if (type === 'boarding_house')   return { q: 'Q14', hint: 'Q14 kos: putra/putri, KM dalam/luar, include makan?' };
  if (type === 'shophouse')        return { q: 'Q14', hint: 'Q14 ruko: jenis bisnis, lantai, lebar depan?' };
  if (type === 'store')            return { q: 'Q14', hint: 'Q14 toko: bisnis, mal/standalone?' };
  if (type === 'office')           return { q: 'Q14', hint: 'Q14 kantor: headcount, grade, fit-out?' };
  if (type === 'warehouse')        return { q: 'Q14', hint: 'Q14 gudang: m², tinggi, loading dock?' };
  if (isLuxury)                    return { q: 'Q14', hint: 'Q14 mansion: pool, smart home, staf, garasi?' };
  if (type === 'kondotel' && !isSewa) return { q: 'Q14', hint: 'Q14 kondotel beli: ROI, unit type, operator?' };
  if (type === 'others')           return { q: 'Q14', hint: 'Q14 others: tujuan, m²/hektar, zonasi?' };

  return null;
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let pass = 0; let fail = 0;
function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}\n     expected: ${expected}\n       actual: ${actual}`);
    fail++;
  }
}

// ─── Group 1: Type detection (12 types) ───────────────────────────────────────
console.log('\n── Group 1: typeOfP0 (12 types) ──');
assert('rumah',         typeOfP0('Mau sewa rumah di Jakarta'),       'house');
assert('apartment',     typeOfP0('Cari apartemen 2 kamar'),          'apartment');
assert('hotel',         typeOfP0('Mau booking hotel mewah'),         'hotel');
assert('villa',         typeOfP0('Sewa villa Bali'),                  'villa');
assert('boarding_house',typeOfP0('Cari kos dekat kampus'),           'boarding_house');
assert('shophouse',     typeOfP0('Mau sewa ruko 2 lantai'),          'shophouse');
assert('store',         typeOfP0('Cari toko di mal'),                'store');
assert('office',        typeOfP0('Butuh kantor 50 orang'),           'office');
assert('warehouse',     typeOfP0('Sewa gudang logistik'),            'warehouse');
assert('mansion',       typeOfP0('Beli mansion di Pondok Indah'),    'mansion');
assert('rumah mewah → mansion', typeOfP0('Cari rumah mewah di Sentul'), 'mansion');
assert('kondotel',      typeOfP0('Investasi kondotel di Bali'),      'kondotel');
assert('others',        typeOfP0('Mau beli tanah kavling'),          'others');

// ─── Group 2: Transaction detection ───────────────────────────────────────────
console.log('\n── Group 2: txOfP0 (booking/investasi keywords) ──');
assert('sewa',      txOfP0('Mau sewa rumah'),                  'rent');
assert('kontrak',   txOfP0('Mau ngontrak 1 tahun'),            'rent');
assert('booking',   txOfP0('Mau booking kondotel di Bali'),    'rent');
assert('pesan',     txOfP0('Mau pesan hotel malam ini'),       'rent');
assert('reservasi', txOfP0('Reservasi villa 2 malam'),         'rent');
assert('beli',      txOfP0('Mau beli rumah'),                  'sale');
assert('investasi', txOfP0('Kondotel untuk investasi'),        'sale');
assert('null',      txOfP0('Cari kos di Surabaya'),            null);

// ─── Group 3: _typeKeyFromWord ────────────────────────────────────────────────
console.log('\n── Group 3: _typeKeyFromWord ──');
assert('kondotel',       _typeKeyFromWord('kondotel'),    'kondotel');
assert('mansion',        _typeKeyFromWord('mansion'),     'mansion');
assert('rumah mewah',    _typeKeyFromWord('rumah mewah'), 'mansion');
assert('villa',          _typeKeyFromWord('villa'),       'villa');
assert('store/toko',     _typeKeyFromWord('toko'),        'store');
assert('others/lahan',   _typeKeyFromWord('lahan'),       'others');

// ─── Group 4: findNextQuestion flow ───────────────────────────────────────────
console.log('\n── Group 4: findNextQuestion flows ──');

// 4a. Villa sewa — Q11 must be SKIPPED, should reach Q14 when all before are set
const villaSewa = {
  buildingType: 'villa', transactionType: 'rent',
  location: 'Bali', searchHistory: 'yes', budget: '2-4jt/minggu',
  household: '2', leaseDuration: '1 minggu',
  furnishing: null  // null but should be SKIPPED
};
assert('villa sewa → Q14 (not Q11)', findNextQuestion(villaSewa).q, 'Q14');

// 4b. Mansion sewa — Q11 must be SKIPPED
const mansionSewa = {
  buildingType: 'mansion', transactionType: 'rent',
  location: 'Pondok Indah', searchHistory: 'yes', budget: '50jt/bln',
  household: '4', leaseDuration: '6 bulan',
  furnishing: null
};
assert('mansion sewa → Q14 (not Q11)', findNextQuestion(mansionSewa).q, 'Q14');

// 4c. Hotel booking — must skip Q2b (searchHistory null), go to Q3 (budget)
const hotelBooking = {
  buildingType: 'hotel', transactionType: 'rent',
  location: 'Jakarta', searchHistory: null, budget: null,  // budget not yet set
  household: null, leaseDuration: null, furnishing: null
};
assert('hotel booking (no budget) → Q3 (skip Q2b)', findNextQuestion(hotelBooking).q, 'Q3');

// 4c2. Hotel booking with budget → Q14 (skipping Q4/Q10/Q11)
const hotelBookingFull = {
  buildingType: 'hotel', transactionType: 'rent',
  location: 'Jakarta', searchHistory: null, budget: '1.5jt/malam',
  household: null, leaseDuration: null, furnishing: null
};
assert('hotel booking + budget → Q14 (skip Q4/Q10/Q11)', findNextQuestion(hotelBookingFull).q, 'Q14');

// 4d. Kondotel beli → Q14 kondotel investasi
const kondotelBeli = {
  buildingType: 'kondotel', transactionType: 'sale',
  location: 'Bali', searchHistory: 'yes', budget: '500jt',
  household: '2', leaseDuration: null, furnishing: null
};
assert('kondotel beli → Q14', findNextQuestion(kondotelBeli).q, 'Q14');
assert('kondotel beli Q14 hint contains ROI', findNextQuestion(kondotelBeli).hint.includes('ROI'), true);

// 4e. Warehouse sewa — commercial: skip Q4 (no household), skip Q11 (no furnishing)
//     Q10 lease duration IS asked for commercial sewa (1yr/3yr contracts matter)
const warehouseSewa = {
  buildingType: 'warehouse', transactionType: 'rent',
  location: 'Bekasi', searchHistory: 'yes', budget: '25jt/bln',
  household: null, leaseDuration: null, furnishing: null
};
assert('warehouse sewa (commercial) → Q10 (skip Q4, not Q11 yet)', findNextQuestion(warehouseSewa).q, 'Q10');

const warehouseSewa2 = { ...warehouseSewa, leaseDuration: '1 tahun' };
assert('warehouse sewa (leaseDuration set) → Q14 (skip Q11)', findNextQuestion(warehouseSewa2).q, 'Q14');

// 4f. House sewa — normal flow: Q10 then Q11 then no Q14 for house
const houseSewa = {
  buildingType: 'house', transactionType: 'rent',
  location: 'Surabaya', searchHistory: 'yes', budget: '3jt/bln',
  household: '4', leaseDuration: null, furnishing: null
};
assert('house sewa → Q10', findNextQuestion(houseSewa).q, 'Q10');

const houseSewa2 = { ...houseSewa, leaseDuration: '1 tahun', furnishing: null };
assert('house sewa (leaseDuration set) → Q11', findNextQuestion(houseSewa2).q, 'Q11');

const houseSewa3 = { ...houseSewa, leaseDuration: '1 tahun', furnishing: 'furnished' };
assert('house sewa (all set) → null', findNextQuestion(houseSewa3), null);

// ─── Group 5: Type-switch detection (P0 boundary) ────────────────────────────
// NOTE: typeOfP0 is Phase 0 only — it returns FIRST match in a sentence.
// Phase 3B switch logic extracts the NEW type keyword independently via _typeKeyFromWord.
// These tests verify _typeKeyFromWord correctly maps new-type words from switch messages.
console.log('\n── Group 5: Type-switch via _typeKeyFromWord (Phase 3B) ──');

// In Phase 3B, regex extracts the new type word after "bukan|ganti|ubah|ralat".
// e.g. "bukan villa, saya mau cari toko" → extracted "toko" → _typeKeyFromWord("toko")
assert('toko → store',          _typeKeyFromWord('toko'),    'store');
assert('gudang → warehouse',    _typeKeyFromWord('gudang'),  'warehouse');
assert('kos → boarding_house',  _typeKeyFromWord('kos'),     'boarding_house');
assert('ruko → shophouse',      _typeKeyFromWord('ruko'),    'shophouse');
assert('kantor → office',       _typeKeyFromWord('kantor'),  'office');
assert('villa (new type) → villa', _typeKeyFromWord('villa'), 'villa');

// typeOfP0 returns FIRST match — "villa" appears before "toko" in priority order
const switchMsg1 = 'Eh maaf, bukan villa, saya mau cari toko di Bandung';
assert('typeOfP0 returns first-match (villa before toko)', typeOfP0(switchMsg1), 'villa');

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n═══════════════════════════════════`);
console.log(`RESULT: ${pass}/${total} passed${fail > 0 ? ` (${fail} FAILED)` : ' ✅ ALL PASS'}`);
console.log(`═══════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
