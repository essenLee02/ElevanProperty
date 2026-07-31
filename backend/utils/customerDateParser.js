/**
 * customerDateParser — deterministic parser for customer move-in / check-in /
 * target-purchase / survey dates (reference date configurable).
 *
 * Return shapes:
 *   { status: 'ok',   date: Date, formatted: '13 Juni 2026' }
 *   { status: 'ask_current_month', monthName, minDay, hint }   // bulan berjalan tanpa tanggal
 *   { status: 'ask_soon', hint }                               // "Segera"/ASAP
 *   { status: 'reject_past', date, formatted, hint, todayFormatted, correctedFormatted }
 *                                                               // tanggal eksplisit sudah lewat.
 *                                                               // `date`/`formatted` = as-stated
 *                                                               // (rejected) value, for callers
 *                                                               // re-parsing an already-captured
 *                                                               // string rather than validating a
 *                                                               // fresh utterance (see rejectPast()).
 *   null                                                       // no date expression found
 *
 * ask_current_month / ask_soon: AI WAJIB bertanya dulu sebelum summary. Jika
 * customer belum tahu / tidak bisa memutuskan / diam → nilai summary =
 * 'Waiting the update'.
 *
 * reject_past: hanya untuk tanggal yang menyebut TAHUN eksplisit dan sudah
 * lewat ("23 Juni 2026", "Februari 2023" saat hari ini 29 Juli 2026). Tanggal
 * TANPA tahun tidak pernah reject_past — §D1 di bawah otomatis memilih tahun
 * depan bila bulan/tanggalnya sudah lewat tahun ini.
 */

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const MONTH_LOOKUP = {
  januari: 1, jan: 1, january: 1,
  februari: 2, pebruari: 2, feb: 2, february: 2,
  maret: 3, mar: 3, mrt: 3, march: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  agustus: 8, agu: 8, agt: 8, ags: 8, agust: 8, aug: 8, august: 8,
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

/** Full leap-year rule: divisible by 4, except centuries, except-except ÷400. */
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function daysInMonth(month0to11, year) {
  return (month0to11 === 1 && isLeapYear(year)) ? 29 : DAYS_IN_MONTH[month0to11];
}

/**
 * Add N calendar months to a date, CLAMPING to the last valid day of the
 * target month instead of overflowing into the next one. JS's native
 * `setMonth()`/Date-constructor arithmetic does NOT do this — "31 Jan + 1
 * bulan" naively becomes "3 Maret", not the correct "28/29 Feb". This is the
 * single most consequential date bug in this file before this rewrite: real
 * customer phrasing like "7 bulan lagi" from 29 Juli 2026 landed on
 * 01 Maret 2027 instead of the correct 28 Februari 2027 (2027 is not a leap
 * year). Exported so callers outside this file (e.g. the viewing-schedule
 * relative-date resolver in chatbotPrivateController.js) share the SAME
 * clamped arithmetic instead of re-implementing their own — a second,
 * uncoordinated implementation is exactly how this bug reappears elsewhere.
 * @param {Date} date
 * @param {number} n - months to add (may be negative)
 * @returns {Date}
 */
function addMonthsClamped(date, n) {
  const origDay = date.getDate();
  const totalMonths = date.getMonth() + n;
  const year = date.getFullYear() + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const clampedDay = Math.min(origDay, daysInMonth(month, year));
  return new Date(year, month, clampedDay);
}

/** Add N calendar years — same clamping concern (29 Feb + 1 year on a non-leap target). */
function addYearsClamped(date, n) {
  return addMonthsClamped(date, n * 12);
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
 * A date with an EXPLICIT year that has already passed is rejected, not
 * silently accepted or reinterpreted — the customer almost certainly meant a
 * different year (typo) or a different date entirely; guessing which is worse
 * than asking. Dates WITHOUT an explicit year never reach this path — §D1
 * logic (isPast → curY+1) already resolves those to a sensible future date.
 *
 * Carries BOTH the original (rejected) date and the suggested correction.
 * The original is for callers re-parsing an ALREADY-CAPTURED value (e.g. a
 * viewingDayRef string stored from an earlier turn) rather than validating a
 * fresh customer utterance — a few hours/days of elapsed real time between
 * turns is not "the customer gave a stale date", so those callers should use
 * `date`/`formatted` and ignore the rejection, while callers validating a
 * message the customer JUST typed should key off `status==='reject_past'`.
 */
function rejectPast(now, originalYear, correctedYear, month1to12, day) {
  const todayFormatted = fmt(now);
  const originalDate = new Date(originalYear, month1to12 - 1, day);
  const correctedDate = new Date(correctedYear, month1to12 - 1, day);
  return {
    status: 'reject_past',
    date: originalDate,
    formatted: fmt(originalDate),
    todayFormatted,
    correctedFormatted: fmt(correctedDate),
    hint: `Tanggal yang disebutkan sudah lewat — hari ini ${todayFormatted}. `
        + `Beri tahu customer dengan sopan (jangan menyalahkan — kemungkinan besar salah ketik tahun), `
        + `sebutkan hari ini, tawarkan koreksi paling mungkin (${fmt(correctedDate)}), dan beri ruang `
        + `untuk tanggal lain. JANGAN menerima tanggal ini sebagai jawaban — tanyakan ulang.`,
  };
}

/** True when a resolved (year, month1to12, day) is strictly before `now` (day-level, ignores time). */
function isBeforeToday(year, month1to12, day, now) {
  const d = new Date(year, month1to12 - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < today;
}

const REL_UNIT_RE = 'hari|minggu|bulan|tahun';

/** Add N of a relative unit to `now`, using clamped month/year math for bulan/tahun. */
function addRelativeUnit(now, n, unit) {
  if (unit === 'hari')   return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  if (unit === 'minggu') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n * 7);
  if (unit === 'bulan')  return addMonthsClamped(now, n);
  /* tahun */            return addYearsClamped(now, n);
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

  // ── "Segera" → mandatory ask, never auto-resolve ────────────────────────
  if (/\b(segera|asap|secepatnya|sesegera mungkin|secepat mungkin)\b/.test(t)) {
    return {
      status: 'ask_soon',
      hint: 'Tanyakan: "Kak, boleh tau kira-kira tanggalnya?" lalu "Baik, kak. Mohon segera info tanggalnya ya." '
          + `Jika customer belum tahu / tidak bisa memutuskan / diam → summary = "${WAITING_THE_UPDATE}".`,
      fallbackSummary: WAITING_THE_UPDATE,
    };
  }

  // ── Category C — RANGE, always take the MAXIMUM (checked before a single
  //    relative expression — "2-4 bulan" must not be read as just "2 bulan"
  //    by a looser pattern matching first). Customer needs the furthest
  //    deadline; scheduling too early is worse than scheduling a bit late.
  //    Accepts optional "lagi"/"kedepan"/"ke depan"/"mendatang" — but does
  //    NOT require it, matching real phrasing like bare "2-4 bulan".
  //
  //    ⚠️ Collision guard: "seminggu"/"per minggu"/"2-4 bulan" also appear
  //    inside RENTAL-PERIOD phrasing ("budget 2-4 juta/seminggu") — a
  //    completely different field's vocabulary. A currency/budget signal
  //    anywhere in the message means the BARE (qualifier-less) relative form
  //    must NOT fire here; only require the qualifier ("lagi"/"kedepan"/
  //    "dalam"/etc.) to disambiguate genuine date intent from a price period.
  //    Same class of bug as the "minggu"=week-vs-Sunday collision — a keyword
  //    that's safe in isolation becomes a false positive once a second field
  //    (money parsing) scans the same text for a different reason.
  const hasCurrencySignal = /\b(jt|juta|rb|ribu|miliar|milyar|budget|harga|anggaran|dana)\b/i.test(t);
  {
    const m = t.match(new RegExp(
      `\\b(\\d{1,3})\\s*[-–]\\s*(\\d{1,3})\\s*(${REL_UNIT_RE})\\b(?:\\s+(?:lagi|kedepan|ke\\s+depan|mendatang))?`
    ));
    if (m && (!hasCurrencySignal || /\b(lagi|kedepan|ke\s+depan|mendatang)\b/.test(m[0]))) {
      const n = Math.max(parseInt(m[1], 10), parseInt(m[2], 10));
      const d = addRelativeUnit(now, n, m[3]);
      return { status: 'ok', date: d, formatted: fmt(d) };
    }
  }

  // ── Category A/B — single relative quantity: bare ("7 bulan"), or with
  //    "lagi"/"kedepan"/"besok ini"/"mendatang"/"dari sekarang"/"dalam N ...".
  //    The qualifier is OPTIONAL — real customers overwhelmingly type the
  //    bare form ("2 minggu", "3 bulan") without any trailing marker.
  //    hari/minggu → add DAYS. bulan/tahun → add CALENDAR months/years with
  //    clamping (addMonthsClamped/addYearsClamped) — never a flat ×30 days,
  //    which drifts further wrong the more months are added.
  {
    let n, unit;
    let m = t.match(new RegExp(`\\b(\\d{1,3})\\s*(${REL_UNIT_RE})\\s+(?:besok(?:\\s+ini)?|kedepan|ke\\s+depan|mendatang|dari\\s+sekarang|lagi)\\b`));
    if (m) { n = parseInt(m[1], 10); unit = m[2]; }
    if (!m) {
      // "sehari/seminggu/sebulan/setahun", with or without a trailing "lagi" —
      // bare "seminggu" alone means "1 week" just as much as "seminggu lagi".
      // Skip when a currency signal is present and "lagi" wasn't said — see
      // the collision guard above ("seminggu" inside "juta/seminggu").
      if (!hasCurrencySignal || /\bse(?:hari|minggu|bulan|tahun)\s+lagi\b/.test(t)) {
        m = t.match(new RegExp(`\\bse(${REL_UNIT_RE})\\b(?:\\s+lagi)?`));
        if (m) { n = 1; unit = m[1]; }
      }
    }
    if (!m) {
      m = t.match(new RegExp(`\\bdalam\\s+(\\d{1,3})\\s*(${REL_UNIT_RE})\\b`));
      if (m) { n = parseInt(m[1], 10); unit = m[2]; }
    }
    if (!m && !hasCurrencySignal) {
      // Bare form: "N unit" with no qualifier at all — but only when the
      // token immediately after isn't a month name (so "3 juni" is never
      // misread as "3 <unit>"; REL_UNIT_RE only matches hari/minggu/bulan/
      // tahun literally, so this is already safe, kept explicit for clarity).
      // Gated on !hasCurrencySignal — see the collision guard above.
      m = t.match(new RegExp(`\\b(\\d{1,3})\\s*(${REL_UNIT_RE})\\b`));
      if (m) { n = parseInt(m[1], 10); unit = m[2]; }
    }
    if (m && n > 0) {
      const d = addRelativeUnit(now, n, unit);
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
    const d = addMonthsClamped(now, 1);
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
      const d = addYearsClamped(now, 1);
      return { status: 'ok', date: d, formatted: fmt(d) };
    }
    forceNextYear = true;
  }

  // ── Numeric dates: DD/MM/YYYY vs MM/DD/YYYY ─────────────────────────────
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
        if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
          if (isBeforeToday(y, mon, day, now)) return rejectPast(now, y, y + 1, mon, day);
          return ok(y, mon, day);
        }
      }
    }
  }

  // ── "YYYY <bulan>" → tanggal 1 bulan tersebut ───────────────────────────
  {
    const m = t.match(new RegExp(`\\b(20\\d{2})\\s+(${MONTH_ALT})\\b`));
    if (m) {
      const y = parseInt(m[1], 10);
      const mon = MONTH_LOOKUP[m[2]];
      if (isBeforeToday(y, mon, 1, now)) return rejectPast(now, y, curY + (mon <= curM ? 1 : 0), mon, 1);
      return ok(y, mon, 1);
    }
  }

  // ── "<DD> <bulan> [tahun]" ───────────────────────────────────────────────
  {
    const m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_ALT})\\b\\.?,?\\s*(\\d{4}|\\d{2})?\\b`));
    if (m) {
      const day = parseInt(m[1], 10);
      const mon = MONTH_LOOKUP[m[2]];
      if (day >= 1 && day <= 31) {
        if (m[3]) {
          const y = normYear(m[3], now);
          if (isBeforeToday(y, mon, day, now)) return rejectPast(now, y, y + 1, mon, day);
          return ok(y, mon, day);
        }
        // "tahun depan" eksplisit di kalimat yang sama → paksa tahun berikutnya.
        if (forceNextYear) return ok(curY + 1, mon, day);
        // no year → nearest future occurrence (already passed → next year)
        const isPast = mon < curM || (mon === curM && day < curD);
        return ok(isPast ? curY + 1 : curY, mon, day);
      }
    }
  }

  // ── "<bulan>[,] <DD> [tahun]" English/comma style ───────────────────────
  {
    const m = t.match(new RegExp(`\\b(${MONTH_ALT})\\b\\.?,?\\s+(\\d{1,2})\\b(?:,?\\s*(\\d{4}|\\d{2}))?`));
    if (m) {
      const mon = MONTH_LOOKUP[m[1]];
      const day = parseInt(m[2], 10);
      const maybeYear = parseInt(m[2], 10) > 31 ? null : m[3];
      if (day >= 1 && day <= 31) {
        if (maybeYear) {
          const y = normYear(maybeYear, now);
          if (isBeforeToday(y, mon, day, now)) return rejectPast(now, y, y + 1, mon, day);
          return ok(y, mon, day);
        }
        if (forceNextYear) return ok(curY + 1, mon, day);
        const isPast = mon < curM || (mon === curM && day < curD);
        return ok(isPast ? curY + 1 : curY, mon, day);
      }
    }
  }

  // ── "<bulan> [tahun]" bare month ─────────────────────────────────────────
  {
    const m = t.match(new RegExp(`\\b(${MONTH_ALT})\\b\\s*(\\d{4})?`));
    if (m) {
      const mon = MONTH_LOOKUP[m[1]];
      const y = m[2] ? parseInt(m[2], 10) : null;

      if (y && y > curY) return ok(y, mon, 1);
      // Explicit past year → REJECT, do not silently reinterpret as "next
      // occurrence". "Februari 2023" is almost certainly a typo or a
      // customer testing the bot, not "Februari 2027" — ask, don't guess.
      if (y && y < curY) return rejectPast(now, y, curY + (mon <= curM ? 1 : 0), mon, 1);

      // current year (explicit or implied)
      if (mon === curM) {
        // Bulan berjalan tanpa tanggal → WAJIB tanya tanggal pastinya
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
      if (mon > curM) return ok(curY, mon, 1);          // bulan depan tahun ini → tgl 1
      return ok(curY + 1, mon, 1);                       // sudah lewat → tahun depan tgl 1
    }
  }

  return null;
}

/** Detect "customer doesn't know the date yet" answers (→ "Waiting the update"). */
function isDontKnowDateAnswer(text = '') {
  const t = String(text).toLowerCase();
  return /\b(belum (tahu|tau|pasti|tentu|bisa|ada|menentukan|memutuskan|kepikiran)|tidak tahu|gak tau|ga tau|nggak tau|belum fix|belum decide|not sure|don'?t know|haven'?t decided|undecided|nanti (saja|dulu|aja)|lihat nanti|belum kepastian)\b/.test(t);
}

module.exports = {
  parseCustomerDate, isDontKnowDateAnswer, WAITING_THE_UPDATE, MONTHS_ID,
  addMonthsClamped, addYearsClamped, isLeapYear,
};
