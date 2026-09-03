'use strict';
/**
 * areaAvailabilityService.js — jawab "ada apartemen di Pakuwon?" dengan FAKTA (M152)
 * ---------------------------------------------------------------------------------
 * Directive pemilik proyek (25 Agu 2026), dari transkrip nyata:
 *   "AI tidak memberikan data secara real dan sesuai permintaan customer. Jika
 *    AI tdk memiliki datanya di database, AI harus tanya apakah customer mau
 *    alternatif area lain. Namun AI tdk melakukan itu, malah AI memberikan
 *    apartemen di area lain, seharusnya AI bertanya dahulu, tidak boleh menebak."
 *
 * KEJADIAN NYATA YANG DITANGANI
 * Customer minta SEWA apartemen di Pakuwon, Surabaya. Di katalog agent, Pakuwon
 * punya 19 apartemen — SEMUANYA DIJUAL, nol disewakan. AI lama tidak pernah
 * memeriksa itu: ia terus meng-interview, lalu diam-diam mengirim listing dari
 * Bulak/Kalijudan/Karang Pilang seolah-olah itu Pakuwon. Dua kesalahan sekaligus
 * (menebak area, dan tidak mengaku barangnya tidak ada).
 *
 * YANG DIKEMBALIKAN — FAKTA SAJA, BUKAN KALIMAT
 * Service ini sengaja tidak menyusun balasan. Ia hanya menjawab:
 *   • ada berapa unit persis di area+transaksi yang diminta?  (exact)
 *   • kalau nol, apakah ada di area itu dengan transaksi LAIN? (crossTransaction)
 *   • area mana saja yang BENAR-BENAR punya stok untuk transaksi ini?
 *     (alternativeAreas — diurut termurah, karena itu yang paling menolong)
 * Penyusun kalimat (Private Agent atau prompt LLM) yang memutuskan kata-katanya.
 * Dengan begitu satu sumber fakta dipakai kedua jalur, tidak ada dua versi.
 *
 * ⚠️ SELALU per-agent (user_id). Katalog agent lain tidak boleh bocor.
 */

const { Op, fn, col, literal } = require('sequelize');
const { Property, City, PropertyLocation, Location } = require('../models');

/** Berapa area alternatif yang ditawarkan sekaligus — cukup untuk memilih, tidak membanjiri. */
const MAX_ALT_AREAS = 6;

/** Normalisasi longgar: "Pakuwon City" ~ "pakuwon", "Darmo Permai" ~ "darmo permai". */
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Jarak edit Levenshtein — dipakai untuk koreksi salah ketik nama area (M160).
 *
 * Directive pemilik proyek (28 Agu 2026), lewat contoh kasus eksplisit:
 * "Chandramas" (ketikan customer) vs "Candramas" (nama asli di database) —
 * beda satu huruf 'h'. Aturan lama menganggap ini AREA YANG TIDAK ADA dan
 * meminta maaf + menawarkan area lain sama sekali, padahal customer jelas
 * memaksudkan area yang memang ada, hanya salah ketik.
 */
function levenshtein(a, b) {
  const s = String(a || ''); const t = String(b || '');
  const m = s.length; const n = t.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = s[i - 1] === t[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[n];
}

/**
 * Transaksi lawan. Dipakai untuk menjawab "sewa tidak ada, tapi ADA yang dijual".
 * Nilai mengikuti kolom properties.transaction_type ('Sale' / 'Rent').
 */
const OTHER_TX = { Sale: 'Rent', Rent: 'Sale' };

/**
 * Cari city_id dari nama kota. Mengembalikan null bila kota tidak dikenal —
 * pemanggil harus memperlakukan itu sebagai "tidak bisa memastikan", BUKAN
 * sebagai "tidak ada stok" (dua hal yang sangat berbeda bagi customer).
 */
async function resolveCityId(cityName) {
  if (!cityName) return null;
  const city = await City.findOne({
    where: { name: { [Op.like]: String(cityName).trim() }, status: 1 },
    attributes: ['city_id'],
  });
  return city ? city.city_id : null;
}

/**
 * ⚠️ "DI Pakuwon" ≠ "DEKAT Pakuwon" — dan menyamakannya persis melahirkan
 * kebohongan yang dikeluhkan pemilik proyek.
 *
 * Versi pertama service ini menggabungkan dua sumber: kolom properties.area DAN
 * tautan property_locations. Hasilnya "sewa apartemen Pakuwon = 2" — padahal
 * nol. Dua unit itu ada di Bulak/Kalijudan yang kebetulan DITANDAI berpatokan
 * "Pakuwon City". Kalau digabung, AI akan bilang "ada 2 apartemen sewa di
 * Pakuwon" lalu mengirim listing Bulak — tepat kesalahan yang sedang diperbaiki.
 *
 * Karena itu keduanya dipisah dan diberi label berbeda:
 *   • exact   → HANYA kolom properties.area. Ini yang boleh disebut "di X".
 *   • nearby  → lewat patokan. Hanya boleh disebut sebagai "dekat X", dan hanya
 *               kalau customer memang menerima tawaran itu.
 */
function areaWhere(area) {
  return { area: { [Op.like]: `%${String(area).trim()}%` } };
}

async function propertyIdsNearLocation(area, cityId, userId) {
  const locs = await Location.findAll({
    where: { status: 1, name: { [Op.like]: `%${String(area).trim()}%` } },
    attributes: ['location_id'],
  });
  if (!locs.length) return [];
  const links = await PropertyLocation.findAll({
    where: { location_id: { [Op.in]: locs.map((l) => l.location_id) } },
    attributes: ['property_id'],
  });
  if (!links.length) return [];
  const rows = await Property.findAll({
    where: {
      property_id: { [Op.in]: links.map((l) => l.property_id) },
      user_id: userId, status: 1, ...(cityId ? { city_id: cityId } : {}),
    },
    attributes: ['property_id'],
  });
  return rows.map((r) => r.property_id);
}

/**
 * Hitung stok untuk satu kombinasi area + transaksi + tipe bangunan.
 * @returns {{count:number, minPrice:number|null}}
 */
async function countIn({ userId, cityId, area, buildingType, transactionType, ids = null }) {
  const where = {
    user_id: userId, status: 1,
    ...(cityId ? { city_id: cityId } : {}),
    ...(buildingType ? { building_type: buildingType } : {}),
    ...(transactionType ? { transaction_type: transactionType } : {}),
    // `ids` = mode "dekat" (daftar property_id dari patokan). Tanpa itu, mode
    // "di" — murni kolom area. Tidak pernah dua-duanya sekaligus (lihat catatan
    // di atas fungsi propertyIdsNearLocation).
    ...(ids ? { property_id: { [Op.in]: ids.length ? ids : ['__none__'] } } : areaWhere(area)),
  };

  const rows = await Property.findAll({
    where,
    attributes: [[fn('COUNT', col('id')), 'n'], [fn('MIN', col('price')), 'mn']],
    raw: true,
  });
  const r = rows[0] || {};
  return { count: Number(r.n || 0), minPrice: r.mn === null || r.mn === undefined ? null : Number(r.mn) };
}

/**
 * Area yang BENAR-BENAR punya stok untuk transaksi & tipe yang diminta.
 * Diurut harga termurah lebih dulu (permintaan pemilik proyek: "Berikan datanya
 * dari harga yang termurah dulu kepada customer").
 */
async function listAlternativeAreas({ userId, cityId, buildingType, transactionType, excludeArea }) {
  const rows = await Property.findAll({
    where: {
      user_id: userId, status: 1,
      ...(cityId ? { city_id: cityId } : {}),
      ...(buildingType ? { building_type: buildingType } : {}),
      ...(transactionType ? { transaction_type: transactionType } : {}),
      area: { [Op.ne]: null },
    },
    attributes: ['area', [fn('COUNT', col('id')), 'n'], [fn('MIN', col('price')), 'mn']],
    group: ['area'],
    order: [[literal('mn'), 'ASC']],
    raw: true,
  });

  const skip = norm(excludeArea);
  return rows
    .filter((r) => r.area && String(r.area).trim())
    // Buang area yang diminta customer (termasuk kecocokan sebagian: customer
    // minta "Pakuwon", area "Pakuwon City" jangan ditawarkan sebagai alternatif
    // — bagi customer itu tempat yang sama).
    .filter((r) => {
      const a = norm(r.area);
      return !skip || (!a.includes(skip) && !skip.includes(a));
    })
    .slice(0, MAX_ALT_AREAS)
    .map((r) => ({ area: r.area, count: Number(r.n), minPrice: r.mn === null ? null : Number(r.mn) }));
}

/**
 * PEMERIKSAAN UTAMA.
 *
 * @param {object} p
 * @param {string} p.userId          agent pemilik katalog (WAJIB)
 * @param {string} [p.city]          nama kota, mis. 'Surabaya'
 * @param {string} p.area            area yang ditanyakan customer, mis. 'Pakuwon'
 * @param {string} [p.buildingType]  'Apartment' | 'House' | ...
 * @param {string} [p.transactionType] 'Sale' | 'Rent'
 * @returns {Promise<{
 *   ok: boolean, area: string, city: string|null,
 *   exact: {count:number, minPrice:number|null},
 *   crossTransaction: {transactionType:string, count:number, minPrice:number|null}|null,
 *   alternativeAreas: Array<{area:string,count:number,minPrice:number|null}>,
 *   verdict: 'available'|'wrong-transaction'|'area-empty'|'unknown'
 * }>}
 */

/** Berapa kota alternatif ditawarkan bila kota yang diminta customer kosong (spec pemilik proyek). */
const MAX_ALT_CITIES = 3;

/**
 * "Apakah agent ini punya listing SAMA SEKALI di kota ini?" — cek yang HARUS
 * dilakukan SEBELUM Q2c (pertanyaan area) diajukan (M164).
 *
 * Kasus nyata yang membuktikan celah ini (29 Agu 2026): customer bilang "mau
 * sewa rumah di Madiun" — Natasha TIDAK PUNYA satu pun listing di Madiun (kota
 * itu bahkan tidak ada di baris manapun properties.city_id miliknya), tapi
 * Q2c tetap bertanya "Di area atau kawasan mana di Madiun?" lengkap dengan
 * empat nama kawasan Madiun dari daftar statis (locationLandmarks.js).
 * Customer bertanya "Anda punya listing dimana?" empat kali berturut-turut
 * dan tetap dibalas "Untuk Rumah sewa di Kartoharjo belum ada" — AI tidak
 * pernah mengaku bahwa KOTA-nya sendiri yang tidak ada, bukan cuma areanya.
 *
 * M160 (sesi sebelumnya) memperbaiki kasus "kota BENAR, area SALAH" (Sidoarjo
 * vs Buduran). Fungsi ini menutup kasus satu tingkat di atasnya: "kota itu
 * sendiri sama sekali tidak ada di katalog agent."
 *
 * @param {string} userId agent pemilik katalog
 * @param {string} city   nama kota yang disebut/diduga dari pesan customer
 * @param {string} [buildingType]
 * @param {string} [transactionType]
 * @returns {Promise<{
 *   ok: boolean,
 *   available: boolean,
 *   alternativeCities: Array<{city:string, count:number}>
 * }>}
 *   available:true → kota ini ADA di katalog, pemanggil lanjut ke gerbang area
 *   seperti biasa. available:false → kota ini TIDAK ADA sama sekali; jangan
 *   tanyakan area apa pun untuknya, tawarkan alternativeCities.
 */
async function checkCityAvailability({ userId, city, buildingType, transactionType }) {
  const base = { ok: false, available: true, alternativeCities: [] };
  if (!userId || !city) return base;

  try {
    // require lokal: agentCoverageService & areaAvailabilityService saling
    // dipakai lintas modul — hindari siklus require di puncak file.
    const { getAgentCoverage } = require('./agentCoverageService');
    const coverage = await getAgentCoverage(userId);
    if (!coverage || !coverage.cities || !coverage.cities.size) return { ...base, ok: true };

    const wantCity = String(city).trim().toLowerCase();
    const hasCity = [...coverage.cities.keys()].some((name) =>
      name.toLowerCase() === wantCity || name.toLowerCase().includes(wantCity) || wantCity.includes(name.toLowerCase()));
    if (hasCity) return { ...base, ok: true };

    // Kota tidak ada — susun alternatif NYATA. Diprioritaskan kota yang punya
    // stok untuk tipe+transaksi yang SAMA dengan permintaan customer (bila
    // sudah diketahui); kalau tidak ada satu pun yang cocok tepat, jatuh ke
    // total listing kota itu — lebih baik menyebut kota yang benar-benar ada
    // daripada diam karena filter terlalu ketat.
    const wantType = String(buildingType || '').toLowerCase();
    const wantTx   = String(transactionType || '').toLowerCase();

    const scored = [...coverage.cities.entries()].map(([name, entry]) => {
      let matchCount = 0;
      for (const t of entry.types.values()) {
        if (wantType && String(t.buildingType).toLowerCase() !== wantType) continue;
        if (wantTx && String(t.transactionType).toLowerCase() !== wantTx) continue;
        matchCount += t.count;
      }
      return { city: name, count: matchCount || entry.total, exact: matchCount > 0 };
    });

    scored.sort((a, b) => (b.exact - a.exact) || (b.count - a.count));
    const alternativeCities = scored.slice(0, MAX_ALT_CITIES).map((s) => ({ city: s.city, count: s.count }));

    return { ok: true, available: false, alternativeCities };
  } catch (err) {
    console.error('[CITY AVAILABILITY ERROR]', err.message);
    return base;   // fail-open: jangan sampai gerbang non-kritis mematikan balasan
  }
}

async function checkAreaAvailability({ userId, city, area, buildingType, transactionType }) {
  const base = {
    ok: false, area: area || '', city: city || null,
    exact: { count: 0, minPrice: null }, crossTransaction: null,
    nearby: { count: 0, minPrice: null },
    alternativeAreas: [], verdict: 'unknown',
  };
  if (!userId || !area) return base;

  try {
    const cityId = await resolveCityId(city);

    // "DI area itu" — kolom properties.area saja.
    const exact = await countIn({ userId, cityId, area, buildingType, transactionType });
    if (exact.count > 0) {
      return { ...base, ok: true, exact, verdict: 'available' };
    }

    /* ── KOREKSI SALAH KETIK (M160) ──────────────────────────────────────────
     * Directive pemilik proyek (28 Agu 2026): "Chandramas" (ketikan customer)
     * vs "Candramas" (nama asli di database) — beda satu huruf. Sebelum
     * menyerah dan bilang "area ini belum ada", cek dulu apakah nama yang
     * diketik customer SANGAT MIRIP salah satu area yang benar-benar ada
     * di katalog agent (jarak edit kecil relatif panjang nama) — kalau ya,
     * itu salah ketik, BUKAN area yang berbeda, dan customer harus langsung
     * melihat listingnya, bukan ditanya-tanya lagi.
     *
     * Ambang: jarak edit <= 2 DAN <= 30% panjang nama yang diketik, supaya
     * nama pendek ("Waru" vs "Waru2") tidak salah cocok dengan nama pendek
     * lain yang kebetulan mirip tapi memang beda tempat.
     */
    const catalogAreas = await listAlternativeAreas({
      userId, cityId, buildingType, transactionType, excludeArea: '',
    });
    if (catalogAreas.length) {
      const wantNorm = norm(area);
      let best = null; let bestDist = Infinity;
      for (const c of catalogAreas) {
        const d = levenshtein(wantNorm, norm(c.area));
        if (d < bestDist) { bestDist = d; best = c; }
      }
      const threshold = Math.max(1, Math.floor(wantNorm.length * 0.3));
      if (best && bestDist > 0 && bestDist <= Math.min(2, threshold)) {
        const corrected = await countIn({
          userId, cityId, area: best.area, buildingType, transactionType,
        });
        if (corrected.count > 0) {
          return {
            ...base, ok: true, exact: corrected, verdict: 'available',
            correctedArea: best.area, originalArea: area,
          };
        }
      }
    }

    // Nol untuk transaksi yang diminta → apakah area ini punya stok dengan
    // transaksi LAIN? Inilah kasus Pakuwon: sewa nol, dijual 19.
    let crossTransaction = null;
    const other = OTHER_TX[transactionType];
    if (other) {
      const cross = await countIn({ userId, cityId, area, buildingType, transactionType: other });
      if (cross.count > 0) crossTransaction = { transactionType: other, ...cross };
    }

    // "DEKAT area itu" — lewat patokan. Dilaporkan TERPISAH; pemanggil wajib
    // menyebutnya "dekat", tidak boleh dijual sebagai "di".
    const nearIds = await propertyIdsNearLocation(area, cityId, userId);
    const nearby = nearIds.length
      ? await countIn({ userId, cityId, area, buildingType, transactionType, ids: nearIds })
      : { count: 0, minPrice: null };

    const alternativeAreas = await listAlternativeAreas({
      userId, cityId, buildingType, transactionType, excludeArea: area,
    });

    return {
      ...base, ok: true, exact, crossTransaction, nearby, alternativeAreas,
      verdict: crossTransaction ? 'wrong-transaction' : 'area-empty',
    };
  } catch (err) {
    // Fail-open: lebih baik AI melanjutkan alur normal daripada percakapan mati
    // hanya karena pemeriksaan ketersediaan gagal.
    console.error('[AREA AVAILABILITY ERROR]', err.message);
    return base;
  }
}

/**
 * Pisahkan mana KOTA dan mana AREA dari beberapa calon string.
 *
 * Perlu karena slot hulu tidak bisa dipercaya namanya: pada transkrip nyata
 * extractQualificationState() mengembalikan `city = 'pakuwon'` (padahal Pakuwon
 * itu area) dan `district = null`. Kalau gerbang menelan itu mentah-mentah, ia
 * akan mencari kota bernama "Pakuwon", tidak menemukannya, lalu gagal senyap.
 *
 * Aturan: calon yang benar-benar ADA di tabel `cities` adalah kota; calon
 * pertama yang BUKAN kota diperlakukan sebagai area.
 *
 * @param {string[]} candidates urut dari yang paling dipercaya
 * @returns {Promise<{city:string|null, area:string|null}>}
 */
/**
 * Apakah string ini masuk akal sebagai NAMA TEMPAT, bukan kalimat?
 *
 * ⚠️ Penjaga wajib. Slot hulu kadang berisi KALIMAT MENTAH customer, bukan
 * nama area. Terbukti di produksi: kandidat area berisi
 * "Hi... Saya beli apartemen Surabaya, Kutisari" sehingga balasannya berbunyi
 * "apartemen dijual di *Hi... Saya beli apartemen Surabaya, Kutisari* belum
 * ada" — memalukan di depan customer, dan pencarian katalog pasti gagal karena
 * tidak ada area bernama begitu.
 *
 * Nama tempat Indonesia praktis selalu ≤ 4 kata ("Pakuwon City", "Darmo
 * Permai", "Dukuh Kupang Barat") dan tidak memuat tanda kalimat.
 */
function looksLikePlaceName(v) {
  const s = String(v || '').trim();
  if (!s || s.length > 40) return false;
  if (/[?!]|\.{2,}|,/.test(s)) return false;            // tanda kalimat/daftar
  if (s.split(/\s+/).length > 4) return false;          // terlalu panjang untuk nama area
  // Kata kerja/intent yang menandakan ini kalimat, bukan tempat.
  if (/\b(saya|aku|mau|ingin|cari|beli|sewa|minta|tolong|apakah|ada|butuh|hi|halo)\b/i.test(s)) return false;
  return true;
}

async function resolveCityAndArea(candidates = []) {
  const seen = [];
  for (const raw of candidates) {
    const v = String(raw || '').trim();
    if (v && looksLikePlaceName(v) && !seen.some((s) => norm(s) === norm(v))) seen.push(v);
  }
  if (!seen.length) return { city: null, area: null };

  const rows = await City.findAll({
    where: { status: 1, name: { [Op.in]: seen.map((s) => s.toUpperCase()) } },
    attributes: ['name'],
  });
  const cityNames = new Set(rows.map((r) => norm(r.name)));

  const city = seen.find((s) => cityNames.has(norm(s))) || null;
  const area = seen.find((s) => !cityNames.has(norm(s))) || null;
  return { city, area };
}

/**
 * Area (kota yang sama) yang punya stok DI DALAM rentang budget yang diminta —
 * dipakai saat area yang customer minta punya stok, tapi tidak satu pun masuk
 * budgetnya (transkrip nyata 26 Agu 2026: customer minta 700-800 juta di Puri
 * Surya Jaya yang cuma ada 1.15M/1.27M, lalu gerbang lama mengirim ulang DUA
 * listing yang sama persis tiga kali — mengabaikan budget yang sudah disebutkan
 * dua kali). Sama gaya dengan listAlternativeAreas (harga termurah dulu),
 * tapi disaring rentang harga alih-alih hanya "punya stok".
 */
async function listAreasWithinBudget({
  userId, cityId, buildingType, transactionType, minPrice, maxPrice, excludeArea, limit = MAX_ALT_AREAS,
}) {
  // ⚠️ M161 — BUG SERIUS DITEMUKAN & DIPERBAIKI: `Op.gte`/`Op.lte` adalah
  // SYMBOL milik Sequelize, dan Object.keys() TIDAK PERNAH mengembalikan
  // properti ber-key Symbol (butuh Object.getOwnPropertySymbols()). Baris lama
  // `if (!Object.keys(priceWhere).length) return [];` karena itu SELALU true
  // — fungsi ini SELALU mengembalikan array kosong sejak ditulis (M156, 26 Agu
  // 2026), apa pun nilai minPrice/maxPrice-nya. Ditemukan lewat uji coba nyata
  // (skenario "Tasha", Gresik 600-700jt): 8 area BENAR-BENAR punya stok dalam
  // rentang itu, tapi gerbang tetap melaporkan "tidak ada alternatif" karena
  // fungsi pemasoknya mati total secara diam-diam. Diganti dengan boolean biasa.
  let hasPriceFilter = false;
  const priceWhere = {};
  if (Number.isFinite(minPrice)) { priceWhere[Op.gte] = minPrice; hasPriceFilter = true; }
  if (Number.isFinite(maxPrice)) { priceWhere[Op.lte] = maxPrice; hasPriceFilter = true; }
  if (!hasPriceFilter) return [];

  const rows = await Property.findAll({
    where: {
      user_id: userId, status: 1,
      ...(cityId ? { city_id: cityId } : {}),
      ...(buildingType ? { building_type: buildingType } : {}),
      ...(transactionType ? { transaction_type: transactionType } : {}),
      area: { [Op.ne]: null },
      price: priceWhere,
    },
    attributes: ['area', [fn('COUNT', col('id')), 'n'], [fn('MIN', col('price')), 'mn']],
    group: ['area'],
    order: [[literal('mn'), 'ASC']],
    raw: true,
  });

  const skip = norm(excludeArea);
  return rows
    .filter((r) => r.area && String(r.area).trim())
    .filter((r) => {
      const a = norm(r.area);
      return !skip || (!a.includes(skip) && !skip.includes(a));
    })
    .slice(0, limit)
    .map((r) => ({ area: r.area, count: Number(r.n), minPrice: r.mn === null ? null : Number(r.mn) }));
}

/**
 * Ambil listing NYATA untuk area+transaksi+tipe, TERMURAH DULU (M154).
 *
 * Directive pemilik proyek (26 Agu 2026):
 *   "Ketika AI mendapatkan informasi tipe transaksi, tipe property, lokasi area
 *    dan kota; AI langsung memberikan 2 listing-an sesuai info ke customer.
 *    Kalau customer langsung minta 4 listing-an, AI langsung memberikan 4."
 *
 * Sebelumnya gerbang ketersediaan hanya bersuara saat stok KOSONG; saat stok
 * ADA ia diam dan alur interview lanjut — persis keluhan customer yang minta
 * listing enam kali dan tetap ditanyai budget/tanggal/penghuni.
 *
 * ⚠️ WAJIB mengembalikan bentuk TERNORMALISASI, bukan baris Sequelize mentah.
 * Versi pertama fungsi ini memakai Property.findAll() dan hasilnya diumpankan
 * ke renderListingCards() — kartu yang keluar rusak dan sempat lolos ke jalur
 * balasan customer:
 *     📍 Lokasi: -
 *     💰 Estimasi Harga: *360000000.0000*     ← angka mentah, bukan "360 juta"
 *     🏠 Tipe: Properti — Tersedia            ← tipe/transaksi gagal diterjemahkan
 *     📐 Luas: bangunan -, tanah -
 *     🏷️ Fasilitas: -                         ← fasilitas ada di tabel lain
 * Penyebabnya: renderListingCards() menunggu bentuk hasil _queryProperties()
 * (price sudah string "360 juta", facilities sudah digabung, imageUrl sudah
 * di-resolve), sedangkan model Property mentah tidak punya satu pun di antaranya.
 *
 * Karena itu sumbernya sekarang getDbPropertiesForAgent() — katalog agent yang
 * SUDAH ternormalisasi dan sudah di-cache (5 menit), jadi ini juga tidak
 * menambah query DB per pesan. Penyaringan dilakukan di memori atas cache itu.
 *
 * @param {number} [minPrice] batas bawah budget customer (opsional)
 * @param {number} [maxPrice] batas atas budget customer (opsional)
 * @returns {Promise<Array>} properti ternormalisasi, siap dirender
 */
async function fetchAreaListings({
  userId, city, area, buildingType, transactionType, limit = 2, minPrice = null, maxPrice = null,
}) {
  if (!userId || !area) return [];
  try {
    // require lokal: propertyRecommendationService besar dan saling terkait —
    // menariknya ke puncak file berisiko siklus require.
    const { getDbPropertiesForAgent } = require('./propertyRecommendationService');
    const rows = await getDbPropertiesForAgent(userId);
    if (!Array.isArray(rows) || !rows.length) return [];

    const wantArea = norm(area);
    const wantType = norm(buildingType);      // 'Apartment' → 'apartment'
    const wantTx   = norm(transactionType);   // 'Sale' → 'sale'
    const wantCity = norm(city);
    const hasMin = Number.isFinite(minPrice);
    const hasMax = Number.isFinite(maxPrice);

    const matched = rows.filter((r) => {
      if (wantArea && !norm(r.area).includes(wantArea)) return false;
      if (wantType && norm(r.buildingType) !== wantType) return false;
      if (wantTx   && norm(r.transactionType) !== wantTx) return false;
      // Kota dicocokkan longgar: r.city/r.location kadang "SURABAYA", kadang
      // kosong pada baris lama. Kalau kosong, jangan buang — area sudah cukup
      // menyempitkan dan membuang baris valid lebih merugikan customer.
      if (wantCity && norm(r.city) && norm(r.city) !== wantCity) return false;
      // Budget customer (mis. "700-800 juta") — bila disebutkan, JANGAN kirim
      // ulang listing yang sudah ditolak customer sebagai "kemahalan" (M156).
      if (hasMin || hasMax) {
        const p = Number(r.priceValue);
        if (!Number.isFinite(p) || p <= 0) return false;
        if (hasMin && p < minPrice) return false;
        if (hasMax && p > maxPrice) return false;
      }
      return true;
    });

    // Termurah dulu — permintaan eksplisit pemilik proyek. priceValue numerik
    // hasil normalisasi; baris tanpa harga ditaruh terakhir, bukan dianggap 0
    // (harga 0 akan menempatkan listing "harga belum diisi" di posisi teratas).
    matched.sort((a, b) => {
      const pa = Number.isFinite(Number(a.priceValue)) && Number(a.priceValue) > 0 ? Number(a.priceValue) : Infinity;
      const pb = Number.isFinite(Number(b.priceValue)) && Number(b.priceValue) > 0 ? Number(b.priceValue) : Infinity;
      return pa - pb;
    });

    return matched.slice(0, Math.max(1, Math.min(Number(limit) || 2, 10)));
  } catch (err) {
    console.error('[FETCH AREA LISTINGS ERROR]', err.message);
    return [];
  }
}

/**
 * Cari nama AREA milik agent yang benar-benar muncul di dalam teks (M155).
 *
 * Kenapa perlu: slot hulu tidak melihat area yang disebut di pesan PERTAMA
 * customer. Transkrip 25 Agu 2026 dibuka dengan
 *   "Hi... Saya mau beli apartemen di Surabaya, Kutisari"
 * — keempat slot ada dalam satu kalimat, tapi filters.location hanya menangkap
 * "Surabaya" dan tidak ada satu pun slot yang berisi "Kutisari". Akibatnya bot
 * menjawab "di area atau kawasan mana di Surabaya?" — menanyakan hal yang baru
 * saja disebut customer di kalimat yang sama. Itu langsung terbaca sebagai
 * "tidak menyimak", dan memang begitu adanya.
 *
 * Dicocokkan ke daftar area NYATA milik agent (bukan tebak-tebakan dari
 * potongan kalimat), dan yang TERPANJANG menang supaya "Pakuwon City" tidak
 * kalah oleh "Pakuwon".
 */
async function findAreaInText({ userId, city, text }) {
  const t = String(text || '').toLowerCase();
  if (!userId || !t.trim()) return null;
  try {
    const cityId = await resolveCityId(city);
    const rows = await Property.findAll({
      where: {
        user_id: userId, status: 1,
        ...(cityId ? { city_id: cityId } : {}),
        area: { [Op.ne]: null },
      },
      attributes: ['area'],
      group: ['area'],
      raw: true,
    });
    const areas = rows.map((r) => String(r.area || '').trim()).filter(Boolean);

    // Lapis 1 — nama area LENGKAP muncul di pesan ("...di Pakuwon City").
    // Terpanjang menang supaya "Pakuwon City" tidak kalah oleh "Pakuwon".
    const exact = areas
      .filter((a) => t.includes(a.toLowerCase()))
      .sort((a, b) => b.length - a.length);
    if (exact.length) return exact[0];

    /* ── Lapis 2 — SEBUTAN PENDEK (M162, transkrip 2 Sep 2026) ───────────────
     * Customer hampir tidak pernah mengetik nama area lengkap. Katalog Natasha
     * (NA40D8N007) menyimpan "Pakuwon City" / "Pakuwon Indah", tapi customer
     * menulis "Di Pakuwon ini, Kak" — lapis 1 mencari "pakuwon city" DI DALAM
     * pesan, tidak ketemu, dan mengembalikan null. Akibatnya gerbang
     * ketersediaan TIDAK PERNAH menyala, LLM berimprovisasi, lalu mengirim
     * listing MERR/Wiyung padahal Pakuwon punya 22 rumah dijual. Diverifikasi
     * langsung: findAreaInText("Di Pakuwon ini, Kak") === null sebelum patch.
     *
     * Jadi arah pencocokan dibalik: cari TOKEN nama area yang muncul sebagai
     * KATA UTUH di pesan. "pakuwon" → cocok "Pakuwon City" & "Pakuwon Indah".
     *
     * ⚠️ Token generik sengaja diabaikan — tanpa daftar ini "Kota"/"Permata"/
     * "Taman" akan mencocokkan area acak dan melahirkan area palsu (kelas bug
     * M92a "Sidotopo"). Token < 4 huruf juga dibuang.
     */
    const GENERIC = new Set(['kota', 'permata', 'taman', 'graha', 'grand', 'green', 'baru',
      'indah', 'jaya', 'city', 'town', 'park', 'residence', 'regency', 'estate', 'villa',
      'darat', 'barat', 'timur', 'utara', 'selatan', 'tengah', 'raya', 'lama']);
    const scored = [];
    for (const a of areas) {
      for (const tok of a.toLowerCase().split(/[^a-z0-9]+/)) {
        if (tok.length < 4 || GENERIC.has(tok)) continue;
        if (new RegExp(`\\b${tok}\\b`, 'i').test(t)) { scored.push({ a, tok }); break; }
      }
    }
    if (!scored.length) return null;

    // Bila satu sebutan cocok ke BEBERAPA area ("Pakuwon" → City & Indah),
    // kembalikan nama TERPENDEK: itu yang paling dekat dengan maksud customer,
    // dan pencocokan katalog memakai LIKE '%area%' sehingga tetap menjaring
    // seluruh varian yang lebih panjang.
    scored.sort((x, y) => x.a.length - y.a.length);
    return scored[0].a;
  } catch (err) {
    console.error('[FIND AREA IN TEXT ERROR]', err.message);
    return null;
  }
}

module.exports = {
  checkCityAvailability,
  MAX_ALT_CITIES,
  checkAreaAvailability,
  fetchAreaListings,
  findAreaInText,
  resolveCityAndArea,
  listAlternativeAreas,
  listAreasWithinBudget,
  resolveCityId,
  MAX_ALT_AREAS,
};
