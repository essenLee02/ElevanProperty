/**
 * customerMoneyParser — deterministic parser for customer money / price ranges.
 *
 * Normalizes free-form budget & rental-price expressions into clean IDR strings:
 *   "2-3 juta"        → "Rp 2.000.000 - Rp 3.000.000"
 *   "312-2 miliar"    → "Rp 312.000.000 - Rp 2.000.000.000"
 *   "600-900K/mlm"    → "Rp 600.000 - Rp 900.000/malam"
 *   "30USD-20"        → "Rp 360.000 - Rp 540.000"  (1 USD = Rp 18.000)
 *
 * Return shapes:
 *   { status:'ok', min:Number, max:Number, period:String|null, currency:'IDR',
 *     formatted:'Rp X - Rp Y[/period]', note:String|null }
 *   null  // no money expression found
 *
 * UNIT LADDER (lowercase keys):
 *   literal(1) · ribu/K(1e3) · juta/jt/million(1e6) · miliar/m/billion(1e9) · triliun/t(1e12)
 *
 * AMBIGUOUS "m": defaults to *miliar* (1e9) — consistent with the budget cases.
 * The full word "million" = juta (1e6). When monthly/nightly rent context suggests
 * "m" = juta, the AI should confirm with the customer (see skill docs).
 */

const USD_RATE = Number(process.env.USD_IDR_RATE || 18000); // 1 USD ≈ Rp 18.000

// Tier ladder (index → multiplier). 0 = literal rupiah.
const TIERS = [1, 1e3, 1e6, 1e9, 1e12];
const TIER_K = 1, TIER_JUTA = 2, TIER_MILIAR = 3, TIER_TRILIUN = 4;

// Inference thresholds (derived from the 51 money + 13 rental reference cases).
const PROMOTE_RATIO = 3;       // bare ≪ partner → bump one tier up
const DEMOTE_LEFT_RATIO = 3;   // bare on the LEFT  ≫ partner → bump one tier down
const DEMOTE_RIGHT_RATIO = 10; // bare on the RIGHT ≫ partner → bump one tier down

function unitTier(u) {
  if (!u) return null;
  const s = u.toLowerCase();
  if (/^(k|rb|ribu|thousand|th)$/.test(s)) return TIER_K;
  if (/^(jt|juta|juta?an|mio|milion|milions|million|millions|mn)$/.test(s)) return TIER_JUTA;
  if (/^(m|miliar|milyar|milliar|billion|billions|bn|b|miliaran)$/.test(s)) return TIER_MILIAR;
  if (/^(t|triliun|trilyun|trilliun|trillion|trillions)$/.test(s)) return TIER_TRILIUN;
  return null;
}

const UNIT_ALT = 'triliun|trilyun|trilliun|trillion|trillions|miliar|milyar|milliar|billion|billions|milions|million|millions|milion|ribu|juta|jutaan|mio|usd|us\\$|\\$|bn|jt|rb|th|mn|k|m|b|t';

/** Detect & strip a trailing rental period; returns { body, period }. */
function extractPeriod(text) {
  const m = text.match(/\/?\s*(?:per\s+)?(malam|mlm|night|nights|minggu|week|weeks|bulan|month|months|tahun|year|years|hari|day|days)\b\.?\s*$/i);
  if (!m) return { body: text, period: null };
  const raw = m[1].toLowerCase();
  const map = {
    mlm: 'malam', malam: 'malam', hari: 'hari', day: 'day', days: 'day',
    night: 'night', nights: 'night', minggu: 'minggu', week: 'week', weeks: 'week',
    bulan: 'bulan', month: 'month', months: 'month',
    tahun: 'tahun', year: 'year', years: 'year',
  };
  return { body: text.slice(0, m.index).trim(), period: map[raw] || raw };
}

/**
 * Normalize a numeric token.
 * Returns { mantissa:Number, grouped:Boolean, round:Boolean }
 *  - "300.000" → grouped round   (thousands-formatted, ends 000)  → literal rupiah
 *  - "900.145" → grouped !round  → bare mantissa 900.145 (dot = decimal carry)
 *  - "3.4" / "2.5" / "721.5" → decimal mantissa
 *  - "812" → plain integer mantissa
 */
function normNum(raw) {
  let s = String(raw).trim().replace(/\s+/g, '').replace(/,/g, '.');
  const segs = s.split('.');
  const cleanGroups = segs.length > 1
    && segs.slice(1).every(g => g.length === 3)
    && segs[0].length >= 1 && segs[0].length <= 3;
  if (cleanGroups) {
    const last = segs[segs.length - 1];
    if (last === '000') {
      // thousands-formatted, round → take literally
      return { mantissa: parseInt(segs.join(''), 10), grouped: true, round: true };
    }
    // non-round grouping → treat dots as a decimal carry: 900.145 → 900.145
    return { mantissa: parseFloat(segs[0] + '.' + segs.slice(1).join('')), grouped: true, round: false };
  }
  // decimal or plain
  if (segs.length > 1) {
    const dec = segs.pop();
    return { mantissa: parseFloat(segs.join('') + '.' + dec), grouped: false, round: false };
  }
  return { mantissa: parseFloat(s), grouped: false, round: false };
}

/** Parse one operand → { fixed?:Number, bare?:{mantissa,tier:null} } or null. */
function parseOperand(tok, usdFlag) {
  if (!tok) return null;
  const m = tok.match(new RegExp(`^\\s*(?:rp\\s*)?(?:\\$|usd\\s*)?([\\d.,\\s]+?)\\s*(${UNIT_ALT})?\\s*$`, 'i'));
  if (!m) return null;
  const num = normNum(m[1]);
  if (!isFinite(num.mantissa)) return null;
  const unit = (m[2] || '').toLowerCase();

  // USD (explicit on this token, or range-wide flag) → convert to IDR literally.
  if (usdFlag || unit === 'usd' || unit === '$' || unit === 'us$') {
    return { fixed: num.mantissa * USD_RATE };
  }

  const tier = unitTier(unit);
  if (tier != null) return { fixed: num.mantissa * TIERS[tier] };

  // bare: round thousands-format → literal rupiah; otherwise needs inference
  if (num.grouped && num.round) return { fixed: num.mantissa };
  return { bare: { mantissa: num.mantissa } };
}

const clampTier = (i) => Math.max(TIER_K, Math.min(TIER_TRILIUN, i));

/** Express a fixed IDR value as { tier, mantissa } with mantissa in [1,1000). */
function tierOf(value) {
  for (let i = TIER_TRILIUN; i >= TIER_K; i--) {
    const mant = value / TIERS[i];
    if (mant >= 1 && mant < 1000) return { tier: i, mantissa: mant };
  }
  // very small (< 1000) → ribu tier reference
  return { tier: TIER_K, mantissa: value / TIERS[TIER_K] };
}

/**
 * Infer a bare number's tier from the partner operand.
 * @param {number}  Bm    bare mantissa
 * @param {number}  Ptier partner tier index
 * @param {number}  Pm    partner mantissa (in [1,1000))
 * @param {boolean} left  is the bare operand on the LEFT?
 */
function inferTier(Bm, Ptier, Pm, left) {
  if (Bm === Pm) return Ptier;
  if (Bm > Pm) {
    const r = Bm / Pm;
    // Leading bare (LEFT) demotes readily; trailing bare (RIGHT) only if hugely bigger.
    const thr = left ? DEMOTE_LEFT_RATIO : DEMOTE_RIGHT_RATIO;
    return (r >= thr) ? clampTier(Ptier - 1) : Ptier;
  }
  // Bm < Pm → promote one tier when the bare is much smaller
  return (Pm / Bm >= PROMOTE_RATIO) ? clampTier(Ptier + 1) : Ptier;
}

/** Format an IDR integer: 2200000 → "Rp 2.200.000". */
function rp(x) {
  const n = Math.round(x);
  const s = String(Math.abs(n));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '.';
    out += s[i];
  }
  return 'Rp ' + (n < 0 ? '-' : '') + out;
}

/**
 * Parse a customer money / price expression.
 * @param {string} text
 * @returns {object|null}
 */
function parseMoneyRange(text) {
  if (!text) return null;
  const raw = String(text).trim();
  // Quick reject: must contain a digit and a currency/unit/range hint.
  if (!/\d/.test(raw)) return null;

  const { body, period } = extractPeriod(raw);
  const usdFlag = /usd|us\$|\$/i.test(body);

  // Normalize range separators → "-"
  let norm = body.replace(/\b(?:sampai|s\/d|sd|hingga|to)\b/gi, '-');
  const parts = norm.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(Boolean);

  let A, B;
  if (parts.length >= 2) {
    A = parseOperand(parts[0], usdFlag);
    B = parseOperand(parts[parts.length - 1], usdFlag);
  } else {
    // single value
    A = parseOperand(parts[0], usdFlag);
    B = null;
  }
  if (!A && !B) return null;

  let note = null;
  if (/\bm\b/i.test(body) && !/miliar|milyar|million|juta/i.test(body)) {
    note = 'Unit "m" diasumsikan miliar; konfirmasi ke customer jika maksudnya juta.';
  }

  // Single value
  if (!B) {
    if (!A) return null;
    let v = A.fixed;
    if (v == null) v = A.bare.mantissa * TIERS[TIER_JUTA]; // bare default → juta
    return { status: 'ok', min: v, max: v, period, currency: 'IDR',
      formatted: `${rp(v)}${period ? '/' + period : ''}`, note };
  }
  if (!A) { A = B; B = null; }

  // Resolve both operands (bare operands inferred from the other side).
  let vA, vB;
  const aFixed = A.fixed != null, bFixed = B && B.fixed != null;

  if (aFixed && bFixed) {
    vA = A.fixed; vB = B.fixed;
  } else if (aFixed && !bFixed) {
    const p = tierOf(A.fixed);
    const t = inferTier(B.bare.mantissa, p.tier, p.mantissa, /*left=*/false);
    vA = A.fixed; vB = B.bare.mantissa * TIERS[t];
  } else if (!aFixed && bFixed) {
    const p = tierOf(B.fixed);
    const t = inferTier(A.bare.mantissa, p.tier, p.mantissa, /*left=*/true);
    vA = A.bare.mantissa * TIERS[t]; vB = B.fixed;
  } else {
    // both bare → default juta
    vA = A.bare.mantissa * TIERS[TIER_JUTA];
    vB = B.bare.mantissa * TIERS[TIER_JUTA];
  }

  const min = Math.min(vA, vB);
  const max = Math.max(vA, vB);
  return {
    status: 'ok', min, max, period, currency: 'IDR',
    formatted: `${rp(min)} - ${rp(max)}${period ? '/' + period : ''}`,
    note,
  };
}

module.exports = { parseMoneyRange, USD_RATE };
