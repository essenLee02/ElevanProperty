/**
 * lazyChatNormalizer.js
 *
 * Expands Indonesian SMS-speak/abbreviations ("blm prnh lht rmh dkt psr" →
 * "belum pernah lihat rumah dekat pasar") before any keyword/regex detector
 * runs on a customer message. Per id-realestate-lazy-chat-normalizer skill:
 * patching each individual detector with 20+ spelling variants doesn't scale
 * and reintroduces the bug every time a new detector is added — normalizing
 * ONCE, up front, means every existing detector keeps working unmodified
 * because it already expects full Indonesian words.
 *
 * SCOPE (deliberate, lower-risk than the skill's full recommendation): only
 * the CURRENT incoming message is expanded before being handed to detectors
 * this turn. Raw text is still what gets SAVED to chat_messages — preserving
 * authenticity for an agent reading the transcript (ai_response=OFF takeover)
 * or any terminal log — so past turns in `history` are NOT retroactively
 * re-expanded. This means a customer's OLD abbreviated messages already in
 * history don't retroactively benefit, but every live detector call THIS turn
 * (extractPropertyFilters, buildProfile, the AI prompt itself) sees the
 * expanded form. Revisit if history-level normalization is ever needed.
 *
 * Safety rules (all from the skill doc — do not violate when extending):
 *   1. Token match, never substring match (enforced by the whitespace-split
 *      implementation below — do not "simplify" this into a global replace).
 *   2. Never map a short token to something that collides with a control word
 *      (e.g. bare "no" as negation) another part of the pipeline depends on.
 *   3. Prefer omitting an abbreviation to risking a wrong-expansion collision.
 *   4. Check any NEW detector keyword against this dictionary AND against
 *      other detectors' vocabularies before shipping.
 *   5. Context-dependent ambiguous words ("minggu" = week vs Sunday) need a
 *      dedicated guard in the CONSUMING detector, not an entry here — "minggu"
 *      is a real word, not an abbreviation, so it is deliberately absent from
 *      ABBR_DICT. (Verified 28 Jul 2026: the one detector in this codebase
 *      that resolves actual weekday VALUES already uses "ahad" for Sunday,
 *      not bare "minggu" — so this collision is already safely avoided at the
 *      one place it would matter.)
 */

'use strict';

/**
 * Explicitly EXCLUDED — documented so nobody re-adds them (see skill doc
 * "Explicitly excluded" section):
 *   'no'      — a live negation/decline signal in yes/no detectors; NEVER map away.
 *   'ci'      — too short (2 letters), collides with name fragments; require
 *               at least "cekin" for check-in support.
 *   'standar' — appears both as a budget-tier word AND inside "fasilitas
 *               standar" (the far more common phrase in this app, per the
 *               Q_FAC standard-facilities fallback) — removed from the
 *               abbreviation dictionary entirely rather than risk silently
 *               overwriting a customer's stated facilities preference with a
 *               budget-tier reading, or vice versa.
 *   'sma'     — a real Indonesian school-level abbreviation (Sekolah Menengah
 *               Atas / senior high school) used constantly as a landmark in
 *               Q2c/Q6 anchor-point answers ("deket SMA 5") — see
 *               LOCATION_LANDMARKS. Mapping it to "sama" would corrupt every
 *               such landmark mention.
 *   'pg'      — same reason: Play Group (preschool) is a live landmark term
 *               in this domain, not just "pagi" shorthand.
 *   'tmn'     — genuinely ambiguous between "teman" (friend, Q4 household
 *               composition) and "taman" (park/garden — a landmark AND a
 *               facility item, e.g. "Taman Depan/Belakang"). No context-free
 *               expansion is safe, so it is left unexpanded.
 *   'bok'     — too short/regionally overloaded (Javanese address particle)
 *               to safely assume it always means "booking".
 */
const ABBR_DICT = {
  // Core particles & connectives
  yg: 'yang', tdk: 'tidak', gk: 'enggak', ga: 'enggak', gak: 'enggak',
  sy: 'saya', jd: 'jadi', jg: 'juga', tp: 'tapi', dr: 'dari', krn: 'karena',
  knp: 'kenapa', gmn: 'bagaimana', bgt: 'banget', msh: 'masih', blh: 'boleh',
  pgn: 'ingin', skrg: 'sekarang', dl: 'dulu', jgn: 'jangan', emg: 'memang',
  emang: 'memang', wkt: 'waktu', bs: 'bisa',

  // Time & scheduling (⚠️ "minggu"/"mgg"/"mnggu" deliberately map to the WEEK
  // unit reading — the customerDateParser.js hari/minggu/bulan/tahun regex
  // already treats "minggu" correctly; the day-name Sunday reading elsewhere
  // in this codebase uses "ahad", never bare "minggu" — see module docstring).
  bsk: 'besok', bsok: 'besok', thn: 'tahun', bln: 'bulan',
  mgg: 'minggu', mnggu: 'minggu', dpn: 'depan', kedpn: 'kedepan',
  lg: 'lagi', lgi: 'lagi', sgr: 'segera', sgra: 'segera',
  pgi: 'pagi', mlm: 'malam', malem: 'malam', mlem: 'malam',
  blm: 'belum', blum: 'belum', prnh: 'pernah', kmrn: 'kemarin',
  tggl: 'tanggal', tgl: 'tanggal', stlh: 'setelah', stelah: 'setelah', sblm: 'sebelum',

  // Location & search
  dkt: 'dekat', dket: 'dekat', deket: 'dekat', psr: 'pasar', skolah: 'sekolah',
  almt: 'alamat', rmh: 'rumah', kmr: 'kamar', cr: 'cari', cri: 'cari',
  lht: 'lihat', mlht: 'melihat', mlihat: 'melihat', lntai: 'lantai',

  // People / relations
  ortu: 'orang tua', krj: 'kerja', krja: 'kerja',
  sm: 'sama', bersm: 'bersama', bersma: 'bersama', brsma: 'bersama',
  org: 'orang',

  // Transaction verbs
  bkng: 'booking', bkg: 'booking', kntrk: 'kontrak',
  ngkos: 'ngekos', pndh: 'pindah', pndah: 'pindah', pindh: 'pindah',
  cekin: 'checkin', movein: 'move in', moving: 'pindah',
  sewaan: 'sewa', beliin: 'beli', nyicil: 'cicil', angsuran: 'cicilan',

  // Politeness / filler
  mksh: 'terima kasih', trims: 'terima kasih', sori: 'maaf', maap: 'maaf',
  gpp: 'tidak apa apa', gapapa: 'tidak apa apa',
  udh: 'sudah', udah: 'sudah', sdh: 'sudah', blg: 'bilang', tny: 'tanya', jwb: 'jawab',

  // Light English chat-speak
  pls: 'please', plz: 'please', thx: 'terima kasih', tq: 'terima kasih',
  np: 'sama sama', btw: 'ngomong ngomong', asap: 'secepatnya',
  idk: 'tidak tahu', imo: 'menurut saya', fyi: 'sebagai informasi',
  rn: 'sekarang', omw: 'dalam perjalanan',

  // English contractions
  "won't": 'will not', "doesn't": 'does not', "don't": 'do not',
  "can't": 'cannot', "isn't": 'is not', "aren't": 'are not',
  "wasn't": 'was not', "weren't": 'were not', "wouldn't": 'would not',
  "couldn't": 'could not', "shouldn't": 'should not', "didn't": 'did not',
  "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not',
  "i'll": 'i will', "i'm": 'i am', "i've": 'i have', "i'd": 'i would',
  "you're": 'you are', "you'll": 'you will', "you've": 'you have',
  "it's": 'it is', "that's": 'that is', "there's": 'there is',
  "let's": 'let us', "we're": 'we are', "we'll": 'we will',
  "they're": 'they are', "they'll": 'they will',
};

/**
 * Expand abbreviations/lazy-chat tokens in a customer message.
 *
 * Token-by-token (split on whitespace only) — NEVER a blind global string
 * replace. A global replace on "ad" would corrupt "ada" itself, "keadaan",
 * "diadakan", etc. Splitting on whitespace and matching the WHOLE token
 * guarantees short abbreviations never eat part of a longer, unrelated word.
 *
 * @param {string} text
 * @returns {string} expanded text (original casing/spacing of non-matched tokens preserved)
 */
function expandAbbreviations(text) {
  if (!text) return text;
  return String(text).split(/(\s+)/).map((w) => {
    // Keep trailing punctuation attached (".", ",", "!", "?", ";", ":") so
    // "yg," → "yang," not "yang" + a dropped comma.
    const m = w.match(/^([^.,!?;:]*)([.,!?;:]*)$/);
    const core = m ? m[1] : w;
    const trail = m ? m[2] : '';
    const lower = core.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ABBR_DICT, lower)) {
      return ABBR_DICT[lower] + trail;
    }
    return w;
  }).join('');
}

module.exports = { expandAbbreviations, ABBR_DICT };
