/**
 * customerDateParser — deterministic parser for customer move-in / check-in /
 * target-purchase dates (35 business rules, reference date configurable).
 *
 * Return shapes:
 *   { status: 'ok',   date: Date, formatted: '13 Juni 2026' }
 *   { status: 'ask_current_month', monthName, minDay, hint }   // rule 25 ("Juni" saat bulan berjalan)
 *   { status: 'ask_soon', hint }                               // rule 35 ("Segera")
 *   null                                                       // no date expression found
 *
 * Rules 25 & 35: AI WAJIB bertanya dulu sebelum summary. Jika customer belum
 * tahu / tidak bisa memutuskan / diam → nilai summary = 'Waiting the update'.
 */

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const MONTH_LOOKUP = {
  januari: 1, jan: 1, january: 1,
  februari: 2, pebruari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agust: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12, december: 12,
};

// Alternation sorted longest-first so "september" wins over "sep"
const MONTH_ALT = Object.keys(MONTH_LOOKUP).sort((a, b) => b.length - a.length).join('|');

const WAITING_THE_UPDATE = 'Waiting the update';

function fmt(d) {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function ok(year, month1to12, day) {
  const d = new Date(year, month1to12 - 1, day);
  return { status: 'ok', date: d, formatted: fmt(d) };
}

function normYear(y, now) {
  if (y == null) return null;
  const n = parseInt(y, 10);
  if (n >= 1000) return n;
  // 2-digit year: "26" → 2026 (same century as `now`)
  return Math.floor(now.getFullYear() / 100) * 100 + n;
}

/**
 * Parse a customer date expression.
 * @param {string} text - customer message (any casing)
 * @param {Date}   now  - reference "today" (default: new Date())
 */
function parseCustomerDate(text, now = new Date()) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const curD = now.getDate();
  // Diset true oleh rule "tahun depan" bila kalimat JUGA berisi tanggal eksplisit
  // ("28 mei tahun depan") — rule hari+bulan di bawah memaksa tahun = curY+1.
  let forceNextYear = false;

  // ── Rule 35: "Segera" → mandatory ask, never auto-resolve ────────────────
  if (/\b(segera|asap|secepatnya|sesegera mungkin|secepat mungkin)\b/.test(t)) {
    return {
      status: 'ask_soon',
      hint: 'Tanyakan: "Kak, boleh tau kira-kira tanggalnya?" lalu "Baik, kak. Mohon segera info tanggalnya ya." '
          + `Jika customer belum tahu / tidak bisa memutuskan / diam → summary = "${WAITING_THE_UPDATE}".`,
      fallbackSummary: WAITING_THE_UPDATE,
    };
  }

  // ── Relative expressions (rules 1, 2, 3, 6, 32, 34) ─────────────────────
  // "N hari besok/kedepan/lagi" HARUS dicek SEBELUM "besok" polos — "viewing
  // 2 hari besok ini" berarti today+2 (15 Juli), bukan besok (14 Juli). Pola
  // "besok" yang rakus dulunya menang duluan dan salah menghitung.
  {
    const m = t.match(/\b(\d{1,3})\s*(hari|minggu|bulan|tahun)\s+(?:besok(?:\s+ini)?|kedepan|ke\s+depan|mendatang|dari\s+sekarang)\b/);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      let d;
      if (unit === 'hari')        d = new Date(curY, curM - 1, curD + n);
      else if (unit === 'minggu') d = new Date(curY, curM - 1, curD + n * 7);
      else if (unit === 'bulan')  d = new Date(curY, curM - 1 + n, curD);
      else /* tahun */            d = new Date(curY + n, curM - 1, curD);
      return { status: 'ok', date: d, formatted: fmt(d) };
    }
  }
  if (/\b(hari ini|sekarang|today)\b/.test(t)) return ok(curY, curM, curD);
  // "besok lusa" = lusa (+2) — cek sebelum "besok" polos.
  if (/\bbesok\s+lusa\b|\blusa\b/.test(t)) {
    const d = new Date(curY, curM - 1, curD + 2);
    return { status: 'ok', date: d, formatted: fmt(d) };
  }
  if (/\b(besok|tomorrow)\b/.test(t)) {
    const d = new Date(curY, curM - 1, curD + 1);
    return { status: 'ok', date: d, formatted: fmt(d) };
  }
  if (/\b(minggu depan|next week)\b/.test(t)) {
    const d = new Date(curY, curM - 1, curD + 7);
    return { status: 'ok', date: d, formatted: fmt(d) };
  }
  if (/\b(bulan depan|next month)\b/.test(t)) {
    const d = new Date(curY, curM, curD); // same day next month (JS rolls over)
    return { status: 'ok', date: d, formatted: fmt(d) };
  }
  if (/\b(tahun depan|next year)\b/.test(t)) {
    // "tanggal 28 mei TAHUN DEPAN" — frasa relatif TIDAK boleh menang atas tanggal
    // eksplisit di kalimat yang sama. Dulu rule ini return duluan (hari-ini +1 thn)
    // → "28 mei tahun depan" jadi "16 Juli 2027". Bila ada pola hari+bulan eksplisit,
    // lewati rule ini — rule "<DD> <bulan>" di bawah yang resolve, dengan tahun
    // dipaksa curY+1 via forceNextYear (tanpa itu, "1 desember tahun depan" yang
    // diucap bulan Juli akan salah jadi Desember TAHUN INI karena belum lewat).
    const hasExplicitDate = new RegExp(`\\b\\d{1,2}\\s+(${MONTH_ALT})\\b`).test(t)
      || new RegExp(`\\b(${MONTH_ALT})\\b\\.?,?\\s+\\d{1,2}\\b`).test(t);
    if (!hasExplicitDate) {
      const d = new Date(curY + 1, curM - 1, curD);
      return { status: 'ok', date: d, formatted: fmt(d) };
    }
    forceNextYear = true;
  }

  // ── "N hari/minggu/bulan/tahun lagi" / "dalam N ..." — relative offset ──
  // Sangat umum dipakai customer ("2 minggu lagi", "sebulan lagi", "dalam
  // 3 hari") tapi sebelumnya tidak ter-resolve sama sekali (moveInDate tetap
  // null walau AI sudah tidak menanyakan Q8 lagi karena aiAskedMoveIn=true).
  {
    let n, unit;
    let m = t.match(/\b(\d{1,3})\s*(hari|minggu|bulan|tahun)\s+lagi\b/);
    if (m) { n = parseInt(m[1], 10); unit = m[2]; }
    if (!m) {
      m = t.match(/\bse(hari|minggu|bulan|tahun)\s+lagi\b/);
      if (m) { n = 1; unit = m[1]; }
    }
    if (!m) {
      m = t.match(/\bdalam\s+(\d{1,3})\s*(hari|minggu|bulan|tahun)\b/);
      if (m) { n = parseInt(m[1], 10); unit = m[2]; }
    }
    if (m) {
      let d;
      if (unit === 'hari')        d = new Date(curY, curM - 1, curD + n);
      else if (unit === 'minggu') d = new Date(curY, curM - 1, curD + n * 7);
      else if (unit === 'bulan')  d = new Date(curY, curM - 1 + n, curD);
      else /* tahun */            d = new Date(curY + n, curM - 1, curD);
      return { status: 'ok', date: d, formatted: fmt(d) };
    }
  }

  // ── Numeric dates: DD/MM/YYYY vs MM/DD/YYYY (rules 15–22) ───────────────
  // Disambiguation: a>12 → DD/MM ; b>12 → MM/DD ; both ≤12 → DD/MM (Indonesian default)
  {
    const m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const y = normYear(m[3], now);
      if (a >= 1 && b >= 1 && a <= 31 && b <= 31) {
        let day, mon;
        if (a > 12 && b <= 12)      { day = a; mon = b; } // DD/MM
        else if (b > 12 && a <= 12) { mon = a; day = b; } // MM/DD
        else if (a <= 12 && b <= 12) { day = a; mon = b; } // ambiguous → DD/MM
        else return null;
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return ok(y, mon, day);
      }
    }
  }

  // ── "YYYY <bulan>" → tanggal 1 bulan tersebut (rule 23) ─────────────────
  {
    const m = t.match(new RegExp(`\\b(20\\d{2})\\s+(${MONTH_ALT})\\b`));
    if (m) return ok(parseInt(m[1], 10), MONTH_LOOKUP[m[2]], 1);
  }

  // ── "<DD> <bulan> [tahun]" (rules 4, 5, 7, 8, 9, 10, 30) ────────────────
  {
    const m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_ALT})\\b\\.?,?\\s*(\\d{4}|\\d{2})?\\b`));
    if (m) {
      const day = parseInt(m[1], 10);
      const mon = MONTH_LOOKUP[m[2]];
      if (day >= 1 && day <= 31) {
        if (m[3]) return ok(normYear(m[3], now), mon, day);
        // "tahun depan" eksplisit di kalimat yang sama → paksa tahun berikutnya.
        if (forceNextYear) return ok(curY + 1, mon, day);
        // no year → nearest future occurrence (already passed → next year)
        const isPast = mon < curM || (mon === curM && day < curD);
        return ok(isPast ? curY + 1 : curY, mon, day);
      }
    }
  }

  // ── "<bulan>[,] <DD> [tahun]" English/comma style (rules 11–14, 31, 33) ─
  {
    const m = t.match(new RegExp(`\\b(${MONTH_ALT})\\b\\.?,?\\s+(\\d{1,2})\\b(?:,?\\s*(\\d{4}|\\d{2}))?`));
    if (m) {
      const mon = MONTH_LOOKUP[m[1]];
      const day = parseInt(m[2], 10);
      const maybeYear = parseInt(m[2], 10) > 31 ? null : m[3];
      if (day >= 1 && day <= 31) {
        if (maybeYear) return ok(normYear(maybeYear, now), mon, day);
        if (forceNextYear) return ok(curY + 1, mon, day);
        const isPast = mon < curM || (mon === curM && day < curD);
        return ok(isPast ? curY + 1 : curY, mon, day);
      }
    }
  }

  // ── "<bulan> [tahun]" bare month (rules 24–29) ──────────────────────────
  {
    const m = t.match(new RegExp(`\\b(${MONTH_ALT})\\b\\s*(\\d{4})?`));
    if (m) {
      const mon = MONTH_LOOKUP[m[1]];
      const y = m[2] ? parseInt(m[2], 10) : null;

      if (y && y > curY) return ok(y, mon, 1);          // explicit future year
      if (y && y < curY) return ok(curY + (mon <= curM ? 1 : 0), mon, 1); // stale year → next occurrence

      // current year (explicit or implied)
      if (mon === curM) {
        // Rule 25: bulan berjalan tanpa tanggal → WAJIB tanya tanggal pastinya
        return {
          status: 'ask_current_month',
          monthName: MONTHS_ID[mon - 1],
          minDay: curD,
          hint: `Customer menyebut bulan berjalan (${MONTHS_ID[mon - 1]}) tanpa tanggal. `
              + `Tanyakan tanggal pastinya — harus ≥ ${curD} ${MONTHS_ID[mon - 1]} ${curY}. `
              + `Jika customer belum tahu / tidak bisa memutuskan / diam → summary = "${WAITING_THE_UPDATE}".`,
          fallbackSummary: WAITING_THE_UPDATE,
        };
      }
      if (mon > curM) return ok(curY, mon, 1);          // rule 26/27: bulan depan tahun ini → tgl 1
      return ok(curY + 1, mon, 1);                      // rule 24/28/29: sudah lewat → tahun depan tgl 1
    }
  }

  return null;
}

/** Detect "customer doesn't know the date yet" answers (→ "Waiting the update"). */
function isDontKnowDateAnswer(text = '') {
  const t = String(text).toLowerCase();
  return /\b(belum (tahu|tau|pasti|tentu|bisa|ada|menentukan|memutuskan|kepikiran)|tidak tahu|gak tau|ga tau|nggak tau|belum fix|belum decide|not sure|don'?t know|haven'?t decided|undecided|nanti (saja|dulu|aja)|lihat nanti|belum kepastian)\b/.test(t);
}

module.exports = { parseCustomerDate, isDontKnowDateAnswer, WAITING_THE_UPDATE, MONTHS_ID };
