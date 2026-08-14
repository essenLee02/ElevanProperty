#!/usr/bin/env node
/**
 * build-rag-index.js — Membangun indeks vektor RAG.
 *
 * Dijalankan OFFLINE (bukan saat melayani chat), lalu hasilnya disimpan ke
 * backend/data/rag-index.json dan dimuat sekali saat backend start.
 * Membangun indeks di jalur permintaan customer akan menambah detik-detik
 * latency dan biaya embedding berulang — jangan pernah lakukan itu.
 *
 * PEMAKAIAN:
 *   node scripts/build-rag-index.js                 # semua namespace
 *   node scripts/build-rag-index.js --skip-db       # tanpa katalog properti
 *   node scripts/build-rag-index.js --only=knowledge
 *   RAG_EMBEDDING_MODE=local node scripts/build-rag-index.js   # tanpa jaringan
 *
 * ⚠️ WAJIB dijalankan ulang setiap kali:
 *   - skill docs referensi berubah
 *   - korpus knowledge/ berubah
 *   - katalog properti agent berubah signifikan
 *   - RAG_EMBEDDING_MODE / model embedding diganti (ruang vektor berbeda)
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const { chunkMarkdown, toEmbeddableText } = require('../utils/ragChunker');
const embeddingService = require('../services/embeddingService');
const vectorStore = require('../services/vectorStoreService');
const { NAMESPACE } = require('../services/ragRetrievalService');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const KNOWLEDGE_DIR = path.join(PROJECT_ROOT, 'knowledge');
const SKILL_DOCS_DIR = path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs');

/**
 * Skill docs yang BOLEH masuk RAG.
 *
 * ⚠️ SENGAJA HANYA DOKUMEN REFERENSI. Dokumen aturan inti (01 core role,
 * 03 conversation memory, 04 qualification flow, 05 completeness, 09 off-topic)
 * TIDAK PERNAH masuk sini — semuanya tetap dimuat penuh setiap giliran.
 * Alasannya: retrieval bisa meleset, dan aturan seperti "never invent",
 * "satu pertanyaan per pesan", atau "state block sumber kebenaran" tidak boleh
 * hilang bahkan sekali pun (lihat M62/M83/M84).
 */
const RAG_ELIGIBLE_SKILL_DOCS = [
  '07-property-type-playbooks.md',
  '08-catalog-and-recommendations.md',
  '10-date-money-parsing.md',
  '11-house-pilots.md',
  '12-facilities-reference.md',
  '13-locations-and-landmarks.md'
];

function parseArgs(argv) {
  const args = { skipDb: false, only: null };
  argv.slice(2).forEach((arg) => {
    if (arg === '--skip-db') args.skipDb = true;
    else if (arg.startsWith('--only=')) args.only = arg.split('=')[1];
  });
  return args;
}

function listMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];

  (function walk(current) {
    fs.readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) found.push(full);
      });
  }(directory));

  return found;
}

async function embedAndStore(namespace, chunks, extraMetadata = {}) {
  if (chunks.length === 0) {
    console.log(`   (tidak ada chunk untuk ${namespace})`);
    return 0;
  }

  const texts = chunks.map(toEmbeddableText);
  const { vectors, model, degraded } = await embeddingService.embedTexts(texts);

  if (degraded) {
    console.warn('   ⚠️  Embedding turun ke mode lokal — kualitas retrieval menurun.');
  }

  vectorStore.clearNamespace(namespace);
  vectorStore.addDocuments(
    namespace,
    chunks.map((chunk, i) => ({
      id: `${namespace}:${chunk.source}:${i}`,
      text: texts[i],
      vector: vectors[i],
      metadata: {
        source: chunk.source,
        breadcrumb: chunk.breadcrumb,
        ...extraMetadata,
        ...chunk.metadata
      }
    })),
    model
  );

  console.log(`   ✅ ${chunks.length} chunk → ${namespace} (model: ${model})`);
  return chunks.length;
}

// ─── Namespace: pengetahuan properti ──────────────────────────────────────────

async function buildKnowledge() {
  console.log('\n📚 Korpus pengetahuan properti (knowledge/)');

  const files = listMarkdownFiles(KNOWLEDGE_DIR);
  if (files.length === 0) {
    console.log(`   (folder ${path.relative(PROJECT_ROOT, KNOWLEDGE_DIR)} kosong / belum ada)`);
    return 0;
  }

  const chunks = files.flatMap((file) => chunkMarkdown(fs.readFileSync(file, 'utf8'), {
    source: path.basename(file),
    metadata: { kind: 'knowledge', relativePath: path.relative(PROJECT_ROOT, file) }
  }));

  files.forEach((f) => console.log(`   • ${path.relative(PROJECT_ROOT, f)}`));
  return embedAndStore(NAMESPACE.PROPERTY_KNOWLEDGE, chunks);
}

// ─── Namespace: referensi skill docs ──────────────────────────────────────────

async function buildSkillReference() {
  console.log('\n📖 Referensi skill docs (HANYA dokumen referensi, bukan aturan inti)');

  const chunks = RAG_ELIGIBLE_SKILL_DOCS.flatMap((name) => {
    const full = path.join(SKILL_DOCS_DIR, name);
    if (!fs.existsSync(full)) {
      console.warn(`   ⚠️  tidak ditemukan: ${name}`);
      return [];
    }
    console.log(`   • ${name}`);
    return chunkMarkdown(fs.readFileSync(full, 'utf8'), {
      source: name,
      metadata: { kind: 'skill_reference' }
    });
  });

  return embedAndStore(NAMESPACE.SKILL_DOCS, chunks);
}

// ─── Namespace: katalog properti per-agent ────────────────────────────────────

/**
 * Mengubah satu baris properti menjadi kalimat deskriptif.
 * Embedding bekerja pada BAHASA, bukan kolom database — deskripsi natural
 * membuat kueri seperti "yang cocok untuk keluarga muda" bisa menemukannya,
 * sesuatu yang tidak bisa dilakukan filter SQL.
 */
function propertyToText(property) {
  const parts = [];

  const transaction = String(property.transaction_type || '').toLowerCase() === 'sale' ? 'dijual' : 'disewakan';
  parts.push(`${property.title || 'Properti'} — ${property.building_type || 'properti'} ${transaction}.`);

  const place = [property.address, property.district, property.area].filter(Boolean).join(', ');
  if (place) parts.push(`Lokasi: ${place}.`);

  if (property.price) {
    const price = Number(property.price);
    if (Number.isFinite(price) && price > 0) {
      parts.push(`Harga: Rp ${price.toLocaleString('id-ID')}${property.price_type ? ` per ${property.price_type}` : ''}.`);
    }
  }

  const rooms = [];
  if (property.bed_rooms) rooms.push(`${property.bed_rooms} kamar tidur`);
  if (property.bath_rooms) rooms.push(`${property.bath_rooms} kamar mandi`);
  if (rooms.length) parts.push(`${rooms.join(', ')}.`);

  const sizes = [];
  if (property.building_area) sizes.push(`luas bangunan ${property.building_area}`);
  if (property.land_area) sizes.push(`luas tanah ${property.land_area}`);
  if (sizes.length) parts.push(`${sizes.join(', ')}.`);

  if (property.furnished_status) parts.push(`Kondisi furnitur: ${property.furnished_status}.`);
  if (property.floor_location) parts.push(`Lantai: ${property.floor_location}.`);
  if (property.kpr_status) parts.push('Bisa KPR.');
  if (property.description) parts.push(String(property.description).slice(0, 600));

  return parts.join(' ');
}

async function buildAgentCatalog() {
  console.log('\n🏘️  Katalog properti per-agent (dari database)');

  let models;
  try {
    models = require('../models');
  } catch (error) {
    console.warn('   ⚠️  Model tidak bisa dimuat, katalog dilewati:', error.message);
    return 0;
  }

  const Property = models.Property || models.property;
  if (!Property) {
    console.warn('   ⚠️  Model Property tidak ditemukan, katalog dilewati.');
    return 0;
  }

  let rows = [];
  try {
    rows = await Property.findAll({ raw: true });
  } catch (error) {
    console.warn('   ⚠️  Query properti gagal (DB mati?), katalog dilewati:', error.message);
    return 0;
  }

  if (rows.length === 0) {
    console.log('   (tabel properties kosong)');
    return 0;
  }

  // Satu properti = SATU chunk. Memecah listing membuat harga terpisah dari
  // namanya — persis cara menghasilkan rekomendasi yang salah harga.
  const chunks = rows.map((row) => ({
    text: propertyToText(row),
    breadcrumb: `Katalog > ${row.title || row.property_id}`,
    source: 'catalog',
    headingPath: [],
    metadata: {
      kind: 'catalog',
      property_id: row.property_id,
      user_id: row.user_id,                 // ⚠️ WAJIB — dasar isolasi per-agent
      building_type: row.building_type,
      transaction_type: row.transaction_type,
      city_id: row.city_id,
      price: row.price
    }
  }));

  const agents = new Set(rows.map((r) => r.user_id));
  console.log(`   ${rows.length} properti dari ${agents.size} agent`);

  return embedAndStore(NAMESPACE.AGENT_CATALOG, chunks);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  console.log('══════════════════════════════════════════════════════');
  console.log('  BUILD RAG INDEX — Elevan Property');
  console.log('══════════════════════════════════════════════════════');
  console.log(`Mode embedding : ${embeddingService.getEmbeddingMode()}`);
  console.log(`Model          : ${embeddingService.getActiveModelName()}`);

  let total = 0;

  if (!args.only || args.only === 'knowledge') total += await buildKnowledge();
  if (!args.only || args.only === 'skills') total += await buildSkillReference();
  if ((!args.only || args.only === 'catalog') && !args.skipDb) total += await buildAgentCatalog();

  if (total === 0) {
    console.log('\n⚠️  Tidak ada yang terindeks — indeks TIDAK ditulis.');
    process.exit(0);
  }

  const saved = vectorStore.saveToDisk();
  console.log('\n──────────────────────────────────────────────────────');
  console.log(saved ? `✅ Indeks tersimpan: ${vectorStore.INDEX_FILE}` : '❌ Gagal menyimpan indeks');
  console.log(`   Total chunk: ${total}`);
  console.log('   Statistik  :', JSON.stringify(vectorStore.getStats().namespaces, null, 2));
  console.log('──────────────────────────────────────────────────────');
  console.log('\nLangkah berikutnya: set RAG_ENABLED=ON di backend/.env lalu restart backend.');

  process.exit(saved ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ Build indeks gagal:', error);
  process.exit(1);
});
