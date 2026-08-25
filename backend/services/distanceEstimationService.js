/**
 * distanceEstimationService.js — M130.
 *
 * Menjawab pertanyaan customer soal JARAK & WAKTU TEMPUH dari lokasi mereka
 * ke alamat properti yang dijual/disewakan agent — mis. "dari rumah saya di
 * Surabaya ke apartemen di Jakarta, Jl. Meruya Selatan No.36, berapa jauh?"
 *
 * ⚠️ KEPUTUSAN ARSITEKTUR (disepakati pemilik proyek, sesi ini):
 *   - GOOGLE_ENABLED tetap FALSE. TIDAK ADA geocoding/Distance Matrix live.
 *     Estimasi HANYA dari tabel koordinat kota statis (utils/cityGeoData.js)
 *     — jarak GARIS LURUS (haversine) kota-ke-kota, BUKAN rute jalan
 *     sesungguhnya. Setiap balasan WAJIB berbunyi "estimasi", tidak pernah
 *     mengklaim presisi alamat-ke-alamat.
 *   - Rute penyeberangan pulau HANYA disebutkan untuk rute MAYOR yang
 *     diyakini akurat (lihat MAJOR_FERRY_ROUTES). Pulau lain → arahkan ke
 *     agent, JANGAN PERNAH menebak nama pelabuhan — salah pelabuhan bisa
 *     membuat customer betul-betul tersesat, beda kelas risiko dari sekadar
 *     nama area yang salah di teks chat.
 *
 * Aturan pita waktu (spesifikasi pemilik proyek):
 *   - Satu pulau, < 200 km        → estimasi mobil saja.
 *   - Satu pulau, 201-350 km      → estimasi kereta + mobil, sebut opsi
 *                                    pesawat/kapal sebagai alternatif.
 *   - Satu pulau, > 350 km        → sarankan pesawat sebagai opsi utama,
 *                                    tetap sertakan estimasi mobil/kereta.
 *   - Beda pulau, rute MAYOR      → sebut pelabuhan asal→tujuan + estimasi
 *                                    waktu penyeberangan + lanjutan ke alamat.
 *   - Beda pulau, rute TIDAK dikenal → arahkan ke agent untuk info
 *                                    penyeberangan pasti, tawarkan cek opsi
 *                                    pesawat sebagai alternatif.
 */
'use strict';

const { getCityGeo, findMajorFerryRoute } = require('../utils/cityGeoData');

const EARTH_RADIUS_KM = 6371;

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Jarak garis lurus (haversine) dalam km antara dua koordinat. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Format jam desimal jadi teks "X jam Y menit" atau rentang. */
function formatHours(hoursLow, hoursHigh) {
  const fmt = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    if (hh <= 0) return `${mm} menit`;
    return mm > 0 ? `${hh} jam ${mm} menit` : `${hh} jam`;
  };
  if (hoursHigh && Math.abs(hoursHigh - hoursLow) > 0.17) return `${fmt(hoursLow)} - ${fmt(hoursHigh)}`;
  return fmt(hoursLow);
}

/**
 * Bangun teks estimasi jarak & waktu antara dua kota yang SUDAH diketahui
 * koordinatnya. Tidak melakukan pencarian nama kota — panggil getCityGeo()
 * di pemanggil (atau estimateDistanceAndTime() di bawah, yang membungkus ini).
 *
 * @param {{lat:number,lng:number,island:string}} origin
 * @param {{lat:number,lng:number,island:string}} destination
 * @param {string} originLabel - nama kota asal untuk teks
 * @param {string} destLabel   - nama kota/alamat tujuan untuk teks
 * @returns {{distanceKm:number, sameIsland:boolean, text:string}}
 */
function buildEstimate(origin, destination, originLabel, destLabel) {
  const distanceKm = Math.round(haversineKm(origin.lat, origin.lng, destination.lat, destination.lng));
  const sameIsland = origin.island === destination.island;

  const disclaimer = '_(Estimasi jarak garis lurus & waktu tempuh kasar — bukan rute jalan presisi. Untuk kepastian rute/waktu, agent bisa bantu cek lebih detail.)_';

  if (sameIsland) {
    // Kecepatan rata-rata mobil di Indonesia (memperhitungkan lalu lintas &
    // jalan non-tol campuran): 40-55 km/jam.
    const carLow = distanceKm / 55;
    const carHigh = distanceKm / 40;

    if (distanceKm < 200) {
      return {
        distanceKm, sameIsland,
        text: `Jarak dari ${originLabel} ke ${destLabel} sekitar ${distanceKm} km.\n` +
          `🚗 Estimasi naik mobil: ${formatHours(carLow, carHigh)} (tergantung lalu lintas).\n\n${disclaimer}`,
      };
    }
    if (distanceKm <= 350) {
      // Kereta di Jawa/Sumatra rata-rata lebih cepat dari mobil untuk jarak
      // menengah: ~70-90 km/jam efektif (headline speed lebih tinggi, tapi
      // ada waktu tunggu/stasiun).
      const trainLow = distanceKm / 90;
      const trainHigh = distanceKm / 70;
      return {
        distanceKm, sameIsland,
        text: `Jarak dari ${originLabel} ke ${destLabel} sekitar ${distanceKm} km.\n` +
          `🚆 Estimasi naik kereta api: ${formatHours(trainLow, trainHigh)}.\n` +
          `🚗 Estimasi naik mobil: ${formatHours(carLow, carHigh)} (tergantung lalu lintas).\n` +
          `✈️ Kalau ingin lebih cepat, saya juga bisa cek estimasi naik pesawat — mau?\n\n${disclaimer}`,
      };
    }
    return {
      distanceKm, sameIsland,
      text: `Jarak dari ${originLabel} ke ${destLabel} sekitar ${distanceKm} km — cukup jauh untuk perjalanan darat.\n` +
        `✈️ Untuk jarak sejauh ini, naik pesawat biasanya jadi opsi paling praktis — mau saya bantu cek estimasinya?\n` +
        `🚗 Kalau tetap memilih jalur darat: estimasi naik mobil sekitar ${formatHours(carLow, carHigh)}.\n\n${disclaimer}`,
    };
  }

  // Beda pulau — perlu penyeberangan.
  //
  // ⚠️ BUG SERIUS YANG DITEMUKAN & DIPERBAIKI SAAT VERIFIKASI SENDIRI:
  // mencocokkan HANYA berdasarkan pasangan pulau (mis. "jawa"↔"sumatra")
  // salah menyarankan rute Merak-Bakauheni untuk Surabaya→Banda Aceh — jarak
  // garis lurus ~2000+ km, padahal Merak-Bakauheni cuma masuk akal untuk kota
  // di Jawa BARAT ke kota DEKAT Bakauheni. Menyarankan pelabuhan spesifik
  // untuk perjalanan sejauh itu jelas menyesatkan (tidak ada yang naik mobil+
  // feri dari Surabaya lalu menyusuri seluruh Sumatra ke Aceh — semua orang
  // akan naik pesawat). Fix: rute mayor HANYA disarankan bila jarak garis
  // lurus TOTAL masih masuk akal untuk perjalanan darat+feri (≤600 km) —
  // di atas itu, SELALU perlakukan seperti rute tak dikenal (arahkan opsi
  // pesawat), terlepas dari apakah pasangan pulaunya "dikenal".
  // 1300 km dipilih supaya Jakarta→Denpasar (garis lurus ~960 km, rute darat
  // nyata & umum dipakai lewat Ketapang-Gilimanuk — bus/travel reguler
  // menempuh ini) TETAP tercakup, sementara Surabaya→Banda Aceh (~2400 km,
  // tidak masuk akal ditempuh darat+feri) TETAP dikecualikan.
  const MAX_FERRY_ROUTE_DISTANCE_KM = 1300;
  const route = distanceKm <= MAX_FERRY_ROUTE_DISTANCE_KM
    ? findMajorFerryRoute(origin.island, destination.island)
    : null;
  if (route) {
    return {
      distanceKm, sameIsland,
      text: `${originLabel} dan ${destLabel} berada di pulau berbeda, jadi perjalanan ini perlu menyeberang.\n` +
        `⛴️ Dari ${originLabel}, arahnya menuju ${route.from}, menyeberang ke ${route.to} ` +
        `(estimasi waktu penyeberangan kapal sekitar ${formatHours(route.crossingMinutes / 60)}), ` +
        `lalu dilanjutkan perjalanan darat ke alamat tujuan di ${destLabel}.\n` +
        `${route.note}\n` +
        `✈️ Kalau lebih suka naik pesawat langsung, saya bisa bantu cek estimasinya juga — mau?\n\n${disclaimer}`,
    };
  }
  return {
    distanceKm, sameIsland,
    text: `${originLabel} dan ${destLabel} berada di pulau berbeda (jarak garis lurus sekitar ${distanceKm} km). ` +
      `Untuk rute penyeberangan/kapal yang pasti ke sana, saya kurang yakin detail pelabuhannya — ` +
      `boleh saya arahkan ke agent untuk info penyeberangan yang lebih akurat?\n` +
      `✈️ Atau kalau berminat, saya bisa bantu cek estimasi naik pesawat sebagai alternatif — mau?`,
  };
}

/**
 * @param {string} originCityName
 * @param {string} destCityName
 * @returns {{distanceKm:number, sameIsland:boolean, text:string}|null} null bila salah satu kota tidak dikenal
 */
function estimateDistanceAndTime(originCityName, destCityName) {
  const origin = getCityGeo(originCityName);
  const destination = getCityGeo(destCityName);
  if (!origin || !destination) return null;
  return buildEstimate(origin, destination, originCityName, destCityName);
}

// ── Deteksi pertanyaan jarak/waktu tempuh dari teks bebas customer ─────────

const DISTANCE_QUESTION_RE = /\bjarak\b|\bberapa\s+jauh\b|\bberapa\s+lama\b|\bwaktu\s+tempuh\b|\btempuh\b|\bmenuju\b|\bdari\b.{0,60}\bke\b/i;

/** True bila pesan customer terlihat seperti pertanyaan jarak/waktu tempuh. */
function looksLikeDistanceQuestion(message) {
  return DISTANCE_QUESTION_RE.test(String(message || ''));
}

/**
 * Cari SEMUA nama kota dikenal (dari CITY_GEO) yang muncul di teks, diurutkan
 * sesuai posisi kemunculan (bukan urutan tabel). Kota dengan nama lebih
 * panjang/spesifik dicek lebih dulu supaya "jakarta selatan" tidak terpotong
 * jadi cocok dengan "jakarta" saja.
 *
 * @param {string} text
 * @returns {string[]} nama kota (key asli dari CITY_GEO) sesuai urutan muncul di teks
 */
function findCitiesInText(text) {
  const { CITY_GEO } = require('../utils/cityGeoData');
  const lower = String(text || '').toLowerCase();
  const names = Object.keys(CITY_GEO).sort((a, b) => b.length - a.length);
  const found = []; // { name, index }
  const claimed = new Array(lower.length).fill(false);

  for (const name of names) {
    let searchFrom = 0;
    for (;;) {
      const idx = lower.indexOf(name, searchFrom);
      if (idx === -1) break;
      const boundaryOk = (idx === 0 || !/[a-z]/.test(lower[idx - 1])) &&
        (idx + name.length >= lower.length || !/[a-z]/.test(lower[idx + name.length]));
      const overlap = claimed.slice(idx, idx + name.length).some(Boolean);
      if (boundaryOk && !overlap) {
        found.push({ name, index: idx });
        for (let i = idx; i < idx + name.length; i++) claimed[i] = true;
      }
      searchFrom = idx + name.length;
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.map((f) => f.name);
}

/**
 * Coba jawab pertanyaan jarak/waktu tempuh customer secara DETERMINISTIK.
 *
 * @param {string} userMessage
 * @param {object} [context]
 * @param {string} [context.propertyCity] - kota properti yang sedang dibahas
 *   (fallback TUJUAN bila customer hanya menyebut SATU kota — asalnya sendiri
 *   — tanpa menyebut ulang kota properti secara eksplisit di pesan yang sama)
 * @returns {string|null} teks balasan siap-kirim, atau null bila tidak bisa dihitung
 *   (kota tidak dikenal / bukan pertanyaan jarak sama sekali)
 */
function tryAnswerDistanceQuery(userMessage, context = {}) {
  if (!looksLikeDistanceQuestion(userMessage)) return null;

  const cities = findCitiesInText(userMessage);
  let originName, destName;

  if (cities.length >= 2) {
    originName = cities[0];
    destName = cities[cities.length - 1];
  } else if (cities.length === 1 && context.propertyCity) {
    const { normalizeCityKey } = require('../utils/cityGeoData');
    const propKey = normalizeCityKey(context.propertyCity);
    // Jangan jadikan tujuan == asal bila customer kebetulan menyebut kota
    // properti itu sendiri sebagai asalnya (edge case tidak masuk akal).
    if (propKey && propKey !== cities[0]) {
      originName = cities[0];
      destName = propKey;
    }
  }

  if (!originName || !destName) return null;

  // ⛔ M137 — ASAL == TUJUAN → JANGAN dijawab di sini. Tabel koordinat modul ini
  // hanya punya SATU titik per kota, jadi "dari Sidoarjo ke Sidoarjo" menghasilkan
  // "sekitar 0 km" — angka yang benar secara matematis tapi OMONG KOSONG bagi
  // customer yang sebenarnya menanyakan jarak ANTAR-AREA di dalam kota yang sama
  // (mis. Pondok Candra → Puri Surya Jaya, ±8,9 km).
  //
  // Guard lama hanya melindungi cabang `cities.length === 1`; cabang >= 2 (kota
  // yang sama disebut dua kali) tetap lolos dan mengirim "0 km" ke customer —
  // dibuktikan langsung lewat node -e sebelum fix ini.
  //
  // Mengembalikan null di sini membuat pertanyaan MENGALIR ke platform AI, yang
  // punya pengetahuan dunia nyata soal jarak antar-kawasan (sesuai directive
  // pemilik proyek: intra-kota adalah rana platform AI, bukan tabel statis
  // backend — GOOGLE_ENABLED=false, jadi tidak ada geocoding presisi di sini).
  // Untuk AI_PRIMARY_PROVIDER='private', Private Agent memang tidak bisa
  // menjawab ini; #tryDistanceAnswer() akan jatuh ke "saya cek dahulu" — jujur,
  // BUKAN mengarang angka.
  if (originName === destName) return null;

  const result = estimateDistanceAndTime(originName, destName);
  return result ? result.text : null;
}

module.exports = {
  haversineKm, formatHours, estimateDistanceAndTime, buildEstimate,
  looksLikeDistanceQuestion, findCitiesInText, tryAnswerDistanceQuery,
};
