'use strict';
/**
 * ragConfidenceService.js — satu skor keyakinan, satu keputusan (M157)
 * ---------------------------------------------------------------------
 * Directive pemilik proyek (27 Agu 2026):
 *   "Pada util seharusnya menjalankan secara bersamaan RAG, RAG Confidence
 *    score, vektor + leksikal, guardrails dan Normalize ... untuk menentukan
 *    chat customer yang layak diteruskan atau didiamkan. Jika RAG Confidence
 *    Score di bawah 0.45 → SKIP; di atas 0.45 → teruskan ke Platform AI."
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  KENAPA SKOR VEKTOR MENTAH TIDAK BOLEH DIPAKAI LANGSUNG SEBAGAI AMBANG
 * ══════════════════════════════════════════════════════════════════════════
 * Diukur pada indeks produksi (27 Agu 2026, embedding hashing-trick lokal):
 *
 *   label       top      mean5    query
 *   ON-TOPIC    0.3369   0.2169   "Apakah ada apartemen di Kutisari?"
 *   ON-TOPIC    0.3331   0.2732   "Saya mau beli rumah di Surabaya"
 *   ON-TOPIC    0.1720   0.1194   "KPR berapa lama tenornya"
 *   ON-TOPIC    0.1213   0.0967   "apa itu SHM?"
 *   GREETING    0.2680   0.2363   "halo kak"
 *   OFF-TOPIC   0.2078   0.0930   "resep nasi goreng enak"
 *   OFF-TOPIC   0.1056   0.0879   "cuaca hari ini gimana"
 *   OFF-TOPIC   0.0874   0.0640   "berapa harga bitcoin"
 *
 * Dua fakta yang menentukan desain modul ini:
 *
 *  1. TIDAK SATU PUN skor mentah menembus 0.45 — bahkan kalimat paling jelas
 *     on-topic ("Saya mau beli rumah di Surabaya") hanya 0.33. Memasang ambang
 *     0.45 pada skor mentah = MENDIAMKAN 100% CUSTOMER. Itu bukan hipotesis,
 *     itu hasil pengukuran.
 *
 *  2. Urutannya pun tidak dapat dipercaya: "apa itu SHM?" (on-topic, 0.12)
 *     berada DI BAWAH "resep nasi goreng enak" (off-topic, 0.21). Cosine di
 *     atas embedding hashing-trick lokal bukan sinyal relevansi yang layak
 *     dipakai sendirian untuk keputusan sebesar "diamkan customer ini".
 *
 * Karena itu angka 0.45 dipertahankan sebagai AMBANG KEPUTUSAN — sesuai
 * directive — tetapi yang diukur terhadapnya adalah SKOR TERKALIBRASI 0..1
 * hasil gabungan beberapa sinyal, bukan cosine mentah. Skor terkalibrasi
 * dirancang agar populasi on-topic jatuh di atas 0.45 dan off-topic di bawah.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  EMPAT SINYAL — DIHITUNG BERSAMAAN (Promise.all)
 * ══════════════════════════════════════════════════════════════════════════
 *   slot     (0.40) Kota/area/tipe/transaksi yang DIKENALI dari master data.
 *                   Sinyal terkuat & termurah: kalau customer menyebut
 *                   "apartemen di Surabaya", tidak ada keraguan soal niat.
 *   lexical  (0.30) Kata kunci properti (hasPropertyKeyword + STANDALONE).
 *                   Terbukti dipakai gate lain di proyek ini.
 *   flow     (0.20) Percakapan yang SEDANG berjalan / AI baru saja bertanya.
 *                   Jawaban singkat "Kutisari" mustahil dinilai lewat isi
 *                   kalimatnya sendiri — konteksnyalah yang menjadikannya sah.
 *   vector   (0.10) Cosine RAG, dinormalisasi. Bobot sengaja KECIL: lihat
 *                   pengukuran di atas — sinyal ini paling lemah di sini.
 *                   Bobotnya naik otomatis kalau indeks diperkaya (lihat
 *                   VECTOR_CEILING).
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  FAIL-OPEN ADALAH ATURAN, BUKAN PILIHAN
 * ══════════════════════════════════════════════════════════════════════════
 * Saat modul ini ditulis, DUA dari tiga namespace RAG kosong
 * (property_knowledge & agent_catalog belum terisi; hanya skill_docs siap).
 * Kalau kegagalan infrastruktur boleh menghasilkan skor rendah, satu indeks
 * yang belum ter-build akan mendiamkan SELURUH customer di semua agent —
 * kerusakan diam-diam yang jauh lebih mahal daripada membalas satu pesan
 * off-topic. Jadi: setiap error, indeks kosong, atau modul mati menghasilkan
 * skor 1.0 (LANJUT), bukan 0.
 *
 * Keputusan mendiamkan customer HANYA boleh lahir dari bukti positif bahwa
 * pesannya memang di luar topik — tidak pernah dari ketiadaan bukti.
 */

const { hasPropertyKeyword,
        isInPropertyFlow,
        lastAiMessageAsksQuestion,
        extractLocationFromMessage,
        extractPropertyTypeFromMessage,
        extractTransactionTypeFromMessage } = require('../utils/propertyKeywordFilter');

/** Ambang keputusan — dari directive pemilik proyek. */
const THRESHOLD = Number(process.env.RAG_CONFIDENCE_THRESHOLD || 0.45);

/**
 * Langit-langit normalisasi skor vektor. Dari pengukuran, skor on-topic
 * terbaik ada di ~0.34; 0.40 memberi sedikit ruang tanpa membuat skor bagus
 * terlihat kecil. Kalau nanti indeks diperkaya (embedding lebih baik / korpus
 * lebih lengkap) dan skor mentah naik, cukup naikkan angka ini — bukan
 * mengubah ambang 0.45 yang sudah jadi kontrak dengan pemilik proyek.
 */
const VECTOR_CEILING = Number(process.env.RAG_VECTOR_CEILING || 0.40);

const WEIGHTS = { slot: 0.40, lexical: 0.30, flow: 0.20, vector: 0.10 };

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/* ────────────────────────────────────────────────────────────────────────
   SINYAL 1 — SLOT: entitas properti yang dikenali master data
──────────────────────────────────────────────────────────────────────── */
function scoreSlots(message) {
  let hits = 0;
  try { if (extractLocationFromMessage(message)) hits++; } catch (_) { /* fail-open */ }
  try { if (extractPropertyTypeFromMessage(message)) hits++; } catch (_) { /* fail-open */ }
  try { if (extractTransactionTypeFromMessage(message)) hits++; } catch (_) { /* fail-open */ }
  // 1 slot sudah cukup kuat (0.6); 2+ praktis pasti (1.0). Bukan linear —
  // "apartemen" saja sudah niat properti yang jelas, tidak perlu 3 slot.
  return hits === 0 ? 0 : hits === 1 ? 0.6 : 1;
}

/* ────────────────────────────────────────────────────────────────────────
   SINYAL 2 — LEKSIKAL: kosakata properti
──────────────────────────────────────────────────────────────────────── */
function scoreLexical(message) {
  try {
    return hasPropertyKeyword(message) ? 1 : 0;
  } catch (_) {
    return 1;   // fail-open
  }
}

/* ────────────────────────────────────────────────────────────────────────
   SINYAL 3 — ALUR: percakapan yang sedang berjalan
   Jawaban sependek "Kutisari" / "2 kamar" / "besok jam 10" TIDAK MUNGKIN
   dinilai dari isinya sendiri. Yang menjadikannya sah adalah AI baru saja
   bertanya. Tanpa sinyal ini, gerbang akan mendiamkan justru customer yang
   paling patuh menjawab pertanyaan kita.
──────────────────────────────────────────────────────────────────────── */
function scoreFlow(message, history) {
  try {
    if (lastAiMessageAsksQuestion(history)) return 1;
    if (isInPropertyFlow(history)) return 0.8;
    return 0;
  } catch (_) {
    return 1;   // fail-open
  }
}

/* ────────────────────────────────────────────────────────────────────────
   SINYAL 4 — VEKTOR: cosine RAG, dinormalisasi
──────────────────────────────────────────────────────────────────────── */
async function scoreVector(message) {
  try {
    const vectorStore = require('./vectorStoreService');
    const embeddingService = require('./embeddingService');
    const { NAMESPACE } = require('./ragRetrievalService');

    vectorStore.ensureLoaded();

    // Namespace yang benar-benar siap saja. Indeks yang belum ter-build
    // TIDAK boleh dihitung sebagai "skor rendah" — itu ketiadaan bukti,
    // bukan bukti ketidakrelevanan. Kembalikan null → sinyal ini diabaikan
    // dan bobotnya dibagikan ke sinyal lain (lihat blend()).
    const ready = Object.values(NAMESPACE).filter((ns) => vectorStore.isReady(ns));
    if (!ready.length) return null;

    const { vector } = await embeddingService.embedText(String(message || '').trim());
    let best = 0;
    for (const ns of ready) {
      const hits = vectorStore.search(ns, vector, { topK: 3, minScore: 0 });
      if (hits.length && hits[0].score > best) best = hits[0].score;
    }
    return clamp01(best / VECTOR_CEILING);
  } catch (err) {
    console.warn('[RAGConfidence] sinyal vektor gagal, diabaikan:', err.message);
    return null;   // diabaikan, bukan 0
  }
}

/**
 * Gabungkan sinyal. Sinyal yang `null` (tidak tersedia) DIKELUARKAN dan
 * bobotnya dinormalisasi ulang ke sinyal yang ada — supaya indeks vektor yang
 * belum siap tidak menyeret skor ke bawah dan mendiamkan customer.
 */
function blend(signals) {
  let total = 0;
  let weightSum = 0;
  for (const [key, value] of Object.entries(signals)) {
    if (value === null || value === undefined) continue;
    total += clamp01(value) * WEIGHTS[key];
    weightSum += WEIGHTS[key];
  }
  if (weightSum === 0) return 1;              // tidak ada sinyal → fail-open
  return clamp01(total / weightSum);
}

/**
 * TITIK MASUK — hitung keyakinan & putuskan.
 *
 * @param {object}   p
 * @param {string}   p.message   pesan customer giliran ini
 * @param {Array}    [p.history] riwayat percakapan ({role, message})
 * @returns {Promise<{
 *   score:number, decision:'REDIRECT'|'SKIP', threshold:number,
 *   signals:object, reason:string
 * }>}
 */
async function scoreConfidence({ message, history = [] } = {}) {
  const text = String(message || '').trim();

  // Pesan kosong tidak punya apa pun untuk dinilai — jangan didiamkan atas
  // dasar itu; biarkan lapisan di atas yang menangani.
  if (!text) {
    return { score: 1, decision: 'REDIRECT', threshold: THRESHOLD, signals: {}, reason: 'pesan kosong — fail-open' };
  }

  try {
    // ── Semua sinyal DIHITUNG BERSAMAAN (directive: "jalan bersamaan") ──
    // Tiga sinyal pertama sinkron & murah; vektor async. Promise.all menjaga
    // latensi = sinyal paling lambat, bukan jumlah seluruhnya.
    const [slot, lexical, flow, vector] = await Promise.all([
      Promise.resolve(scoreSlots(text)),
      Promise.resolve(scoreLexical(text)),
      Promise.resolve(scoreFlow(text, history)),
      scoreVector(text),
    ]);

    const signals = { slot, lexical, flow, vector };

    /* ── OVERRIDE: dua keadaan yang TIDAK BOLEH kalah oleh rata-rata ───────
     * Kalibrasi pertama modul ini meloloskan off-topic dengan sempurna (5/5)
     * tapi hanya 3 dari 8 pesan on-topic — ia MENDIAMKAN "Kutisari",
     * "2 kamar", "Bsk jam 10" dan "Saya minta listing". Persis customer yang
     * paling patuh dan paling siap closing. Sebabnya struktural, bukan bobot
     * yang kurang pas:
     *
     *  (a) Jawaban atas pertanyaan AI. Kalau AI baru saja bertanya "Di area
     *      mana?", balasan "Kutisari" itu SAH menurut definisi — keabsahannya
     *      datang dari konteks, bukan dari isi kalimat. Sinyal seberbobot
     *      0.20 secara matematis tidak akan pernah mencapai 0.45 sendirian,
     *      jadi memperbesar bobot hanya menunda masalah yang sama. Yang benar
     *      adalah memperlakukannya sebagai override.
     *
     *  (b) Permintaan listing eksplisit. "Saya minta listing" / "minta 4
     *      data" adalah niat beli paling terang yang bisa diketik customer.
     *      Kosakata itu kebetulan tidak ada di daftar kata kunci properti,
     *      sehingga skornya 0.08 dan akan didiamkan. Memakai detektor yang
     *      SUDAH ada (areaAvailabilityGate) lebih baik daripada menyalin
     *      daftar kata baru — kelas bug M27/M77.
     *
     * Override hanya boleh MENAIKKAN ke REDIRECT, tidak pernah menurunkan ke
     * SKIP: arah itu aman (paling buruk membalas satu pesan yang tidak perlu),
     * arah sebaliknya membuat customer sungguhan dibisukan.
     */
    let override = null;
    if (flow === 1) override = 'membalas pertanyaan AI sebelumnya';
    if (!override) {
      try {
        const { customerAsksAvailability } = require('../utils/areaAvailabilityGate');
        if (customerAsksAvailability(text)) override = 'permintaan listing/ketersediaan eksplisit';
      } catch (_) { /* fail-open: override sekadar tidak aktif */ }
    }
    if (!override) {
      // (c) Pertanyaan istilah legal (SHM/SHGB/SHMSRS/KPR/AJB/PPJB). Kalimat
      //     seperti "apa itu SHM?" tidak menyebut kota, tipe, maupun transaksi,
      //     dan bukan jawaban atas pertanyaan AI — skornya 0.33 dan akan
      //     didiamkan. Padahal ini justru pertanyaan yang pernah diabaikan
      //     empat kali berturut-turut di transkrip produksi (M129/M132).
      //     Dipakai detektor terminologi yang SUDAH ada sebagai sumber
      //     kebenaran, bukan daftar istilah kedua yang pasti melenceng.
      try {
        const { tryTerminologyAnswer } = require('../utils/terminologyAnswerGate');
        if (tryTerminologyAnswer(text)) override = 'pertanyaan istilah legal/sertifikat';
      } catch (_) { /* fail-open */ }
    }

    if (!override) {
      /* (d) M159 — PERTANYAAN JARAK / WAKTU TEMPUH.
       * Arahan pemilik proyek (28 Agu 2026): "Jika ada orang yang tanya jarak
       * lokasi atau waktu lokasi yang dibutuhkan, RAG dan guardrails masih bisa
       * confidence dengan baik, agar pertanyaannya bisa dilempar ke platform AI."
       *
       * Kalimat seperti "berapa jarak dari Kutisari ke Tunjungan Plaza?" tidak
       * menyebut transaksi maupun tipe properti, jadi sinyal slot & leksikal
       * nyaris nol. Diukur sebelum perbaikan: 0.053 → SKIP. Padahal ini
       * pertanyaan pembeli yang sangat wajar (seberapa jauh dari kantor/sekolah)
       * dan proyek ini SUDAH punya jawabannya (fitur estimasi jarak M130).
       *
       * Dua bagian wajib ada bersamaan supaya "berapa lama KPR-nya?" tidak ikut
       * tertangkap: kata ukuran jarak/waktu DAN penanda arah lokasi (ke/dari/
       * menuju/sampai).
       */
      const DIST_RE = /\b(jarak|berapa\s+jauh|seberapa\s+jauh|berapa\s+lama|waktu\s+tempuh|berapa\s+menit|berapa\s+km|berapa\s+kilometer|how\s+far|how\s+long|distance|travel\s+time)\b/i;
      const DIR_RE  = /\b(ke|dari|menuju|sampai|hingga|to|from)\b/i;
      if (DIST_RE.test(text) && DIR_RE.test(text)) {
        override = 'pertanyaan jarak/waktu tempuh ke lokasi';
      }
    }

    const score = override ? 1 : blend(signals);
    const decision = score >= THRESHOLD ? 'REDIRECT' : 'SKIP';

    if (override) {
      return {
        score, decision, threshold: THRESHOLD, signals,
        reason: `override: ${override} → REDIRECT`,
      };
    }

    const parts = Object.entries(signals)
      .map(([k, v]) => `${k}=${v === null ? 'n/a' : Number(v).toFixed(2)}`)
      .join(' ');

    return {
      score, decision, threshold: THRESHOLD, signals,
      reason: `${parts} → ${score.toFixed(3)} ${decision === 'SKIP' ? '<' : '>='} ${THRESHOLD}`,
    };
  } catch (err) {
    // Kegagalan modul TIDAK BOLEH mendiamkan customer.
    console.warn('[RAGConfidence] gagal total, fail-open ke REDIRECT:', err.message);
    return {
      score: 1, decision: 'REDIRECT', threshold: THRESHOLD, signals: {},
      reason: `error: ${err.message} — fail-open`,
    };
  }
}

module.exports = {
  scoreConfidence,
  THRESHOLD,
  WEIGHTS,
  VECTOR_CEILING,
  // diekspor untuk pengujian per-sinyal
  scoreSlots,
  scoreLexical,
  scoreFlow,
  scoreVector,
  blend,
};
