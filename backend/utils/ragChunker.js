/**
 * ragChunker.js — Pemecah dokumen Markdown menjadi "chunk" untuk RAG.
 *
 * KENAPA BUKAN SPLITTER GENERIK (mis. RecursiveCharacterTextSplitter):
 * Skill docs Elevan penuh TABEL Markdown yang maknanya hancur bila dipotong
 * di tengah (tabel tier budget, pasangan Hindari↔Prefer, daftar fasilitas
 * standar per tipe, tabel BENAR/SALAH Q7). Pemotong berbasis jumlah karakter
 * akan memotong tabel di tengah baris dan menghasilkan aturan yang menyesatkan
 * — persis kelas kesalahan yang selama ini menyebabkan LLM mengarang nilai.
 *
 * Aturan pemecahan (urut prioritas):
 *   1. Potong pada BATAS HEADING (##, ###) — satu bagian = satu unit makna.
 *   2. Bila satu bagian masih terlalu besar, potong pada BARIS KOSONG
 *      (batas paragraf), TIDAK PERNAH di dalam blok tabel atau blok kode.
 *   3. Setiap chunk diberi "breadcrumb" heading induknya, supaya chunk yang
 *      berdiri sendiri tetap punya konteks saat diambil oleh retriever.
 *
 * Chunk tanpa breadcrumb adalah penyebab utama jawaban RAG yang ngawur:
 * potongan "1. Tempat panas" tanpa induk "Q5 → tabel Hindari" tidak bermakna.
 */

'use strict';

const DEFAULT_MAX_CHARS = Number(process.env.RAG_CHUNK_MAX_CHARS || 1800);
const DEFAULT_MIN_CHARS = Number(process.env.RAG_CHUNK_MIN_CHARS || 120);

/** Baris pembuka/penutup blok kode berpagar (``` atau ~~~). */
const FENCE_RE = /^\s*(```|~~~)/;

/** Baris yang merupakan bagian dari tabel Markdown (mengandung pipa). */
function isTableLine(line) {
  return /^\s*\|/.test(line) || /\|\s*$/.test(line);
}

/** Heading ATX Markdown: `# `, `## `, dst. Mengembalikan {level, text} atau null. */
function parseHeading(line) {
  const match = /^(#{1,6})\s+(.*\S)\s*$/.exec(line);
  if (!match) return null;
  return { level: match[1].length, text: match[2].trim() };
}

/**
 * Menandai setiap baris: apakah ia berada di dalam blok yang TIDAK BOLEH dipotong
 * (blok kode berpagar atau tabel Markdown). Dipakai agar pemotongan paragraf
 * tidak pernah jatuh di tengah tabel/kode.
 *
 * @param {string[]} lines
 * @returns {boolean[]} protected[i] === true → baris i tidak boleh jadi titik potong
 */
function markProtectedLines(lines) {
  const flags = new Array(lines.length).fill(false);
  let insideFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      // Baris pagar itu sendiri ikut terlindungi, dan status blok dibalik.
      insideFence = !insideFence;
      flags[i] = true;
      continue;
    }

    if (insideFence) {
      flags[i] = true;
      continue;
    }

    if (isTableLine(line)) {
      flags[i] = true;
    }
  }

  return flags;
}

/**
 * Membangun breadcrumb heading untuk sebuah posisi baris.
 * Contoh hasil: "04-qualification-flow.md > 3. The Question Sequence > Q3 — Budget"
 */
function buildBreadcrumb(sourceLabel, headingStack) {
  return [sourceLabel, ...headingStack.map((h) => h.text)].filter(Boolean).join(' > ');
}

/**
 * Memotong satu blok teks panjang menjadi beberapa bagian pada batas paragraf,
 * tanpa pernah memotong di dalam tabel/kode.
 *
 * @param {string[]} lines   baris-baris blok
 * @param {boolean[]} guarded  penanda baris terlindungi (sejajar dengan `lines`)
 * @param {number} maxChars
 * @returns {string[]}
 */
function splitOnParagraphBoundaries(lines, guarded, maxChars) {
  const parts = [];
  let current = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length === 0) return;
    const text = current.join('\n').trim();
    if (text) parts.push(text);
    current = [];
    currentLength = 0;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    current.push(line);
    currentLength += line.length + 1;

    if (currentLength < maxChars) continue;

    // Sudah melewati batas: cari titik potong AMAN paling dekat ke belakang,
    // yaitu baris kosong yang tidak terlindungi.
    let cut = -1;
    for (let j = i; j > i - current.length + 1; j -= 1) {
      if (lines[j].trim() === '' && !guarded[j]) {
        cut = j;
        break;
      }
    }

    if (cut === -1) {
      // Tidak ada titik potong aman (mis. satu tabel raksasa) — biarkan utuh.
      // Chunk kebesaran jauh lebih baik daripada tabel yang rusak.
      continue;
    }

    const keepCount = current.length - (i - cut) - 1;
    const head = current.slice(0, keepCount);
    const tail = current.slice(keepCount);

    const headText = head.join('\n').trim();
    if (headText) parts.push(headText);

    current = tail;
    currentLength = tail.reduce((sum, l) => sum + l.length + 1, 0);
  }

  flush();
  return parts;
}

/**
 * Memecah satu dokumen Markdown menjadi chunk siap-embed.
 *
 * @param {string} markdown        isi berkas
 * @param {object} [options]
 * @param {string} [options.source]    label sumber (mis. nama berkas)
 * @param {number} [options.maxChars]
 * @param {number} [options.minChars]  chunk lebih pendek dari ini digabung ke sebelumnya
 * @param {object} [options.metadata]  metadata tambahan yang disalin ke setiap chunk
 * @returns {Array<{text:string, breadcrumb:string, source:string, headingPath:string[], metadata:object}>}
 */
function chunkMarkdown(markdown, options = {}) {
  const source = options.source || 'unknown';
  const maxChars = Number(options.maxChars || DEFAULT_MAX_CHARS);
  const minChars = Number(options.minChars || DEFAULT_MIN_CHARS);
  const metadata = options.metadata || {};

  const normalized = String(markdown || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return [];

  const lines = normalized.split('\n');
  const guarded = markProtectedLines(lines);

  // ── Tahap 1: kelompokkan baris per bagian heading ──────────────────────────
  const sections = [];
  let headingStack = [];
  let buffer = [];
  let bufferGuard = [];
  let sectionStack = [];

  const pushSection = () => {
    if (buffer.length === 0) return;
    const text = buffer.join('\n').trim();
    if (text) {
      sections.push({
        lines: buffer.slice(),
        guarded: bufferGuard.slice(),
        headingStack: sectionStack.slice()
      });
    }
    buffer = [];
    bufferGuard = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const heading = guarded[i] ? null : parseHeading(lines[i]);

    if (heading) {
      pushSection();
      // Buang heading yang levelnya >= heading baru, lalu dorong yang baru.
      headingStack = headingStack.filter((h) => h.level < heading.level);
      headingStack.push(heading);
      sectionStack = headingStack.slice();
    }

    buffer.push(lines[i]);
    bufferGuard.push(guarded[i]);
  }
  pushSection();

  // ── Tahap 2: pecah bagian yang masih kebesaran, lalu rakit chunk ───────────
  const chunks = [];

  sections.forEach((section) => {
    const breadcrumb = buildBreadcrumb(source, section.headingStack);
    const sectionText = section.lines.join('\n').trim();
    if (!sectionText) return;

    // Bagian yang HANYA berisi baris heading (heading H2 langsung diikuti
    // heading H3, tanpa paragraf pembuka di antaranya) tidak boleh jadi chunk
    // sendiri — isinya cuma judul, tidak bermakna berdiri sendiri sebagai
    // jawaban maupun sebagai konteks retrieval. Headingnya SUDAH ikut
    // breadcrumb bagian anak (headingStack bersifat kumulatif), jadi tidak ada
    // informasi yang hilang dengan melewatkan bagian ini.
    const bodyOnly = section.lines
      .filter((line) => !parseHeading(line))
      .join('\n')
      .trim();
    if (!bodyOnly) return;

    const pieces = sectionText.length <= maxChars
      ? [sectionText]
      : splitOnParagraphBoundaries(section.lines, section.guarded, maxChars);

    pieces.forEach((piece) => {
      const text = piece.trim();
      if (!text) return;

      const previous = chunks[chunks.length - 1];

      // Chunk mungil (mis. heading yatim) digabung ke chunk sebelumnya selama
      // masih satu bagian — mencegah banjir chunk tak bermakna di indeks.
      if (
        previous
        && text.length < minChars
        && previous.breadcrumb === breadcrumb
        && previous.text.length + text.length <= maxChars
      ) {
        previous.text = `${previous.text}\n\n${text}`;
        return;
      }

      chunks.push({
        text,
        breadcrumb,
        source,
        headingPath: section.headingStack.map((h) => h.text),
        metadata: { ...metadata }
      });
    });
  });

  return chunks;
}

/**
 * Teks final yang di-embed DAN yang disuntikkan ke prompt.
 * Breadcrumb ikut di-embed supaya kemiripan semantik memperhitungkan konteks
 * induknya ("Q5 Red Flags" vs "Q3 Budget" adalah sinyal kuat).
 */
function toEmbeddableText(chunk) {
  if (!chunk) return '';
  const breadcrumb = chunk.breadcrumb ? `[${chunk.breadcrumb}]\n` : '';
  return `${breadcrumb}${chunk.text}`.trim();
}

module.exports = {
  chunkMarkdown,
  toEmbeddableText,
  // diekspor untuk pengujian unit
  parseHeading,
  markProtectedLines,
  splitOnParagraphBoundaries,
  DEFAULT_MAX_CHARS,
  DEFAULT_MIN_CHARS
};
