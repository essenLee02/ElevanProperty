<template>
  <!-- ════════════════════════════════════════════════════════════════════
       Modal.vue — pemilih data terhubung database (reusable)
       ────────────────────────────────────────────────────────────────────
       Dipanggil secara imperatif dari parent:
         modalRef.value.open({ title, headers, chunks, actionParams,
                               multiSelect, fetch, onChoose, initialSearch })

       Tabel dibangun oleh window.tableModal (Function_Path) dengan
       ACTION_PARAMS:
         - 'choose'  → tombol pilih satu data  (single select)
         - 'check'   → checkbox pilih banyak    (multi  select)

       Pencarian:
         - ketik "in"  → server filter LIKE %in%  (mis. Indonesia, India)
         - ketik "*"   → tampilkan SEMUA data (filter dilewati)
  ════════════════════════════════════════════════════════════════════════ -->
  <div v-if="visible" class="cf-modal-overlay" @click.self="close">
    <div class="cf-modal-box">

      <!-- Header -->
      <div class="cf-modal-header">
        <h5 class="cf-modal-title">{{ title }}</h5>
        <button type="button" class="cf-modal-x" @click="close" aria-label="Tutup">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Search bar -->
      <div class="cf-modal-search">
        <input
          ref="searchInput"
          v-model="searchText"
          type="text"
          class="cf-modal-search-input"
          :placeholder="placeholder"
          @keydown.enter.prevent="runSearch(1)"
        />
        <button type="button" class="cf-modal-btn cf-modal-btn-search" @click="runSearch(1)">
          <i class="fa-solid fa-magnifying-glass"></i> Cari
        </button>
        <button type="button" class="cf-modal-btn cf-modal-btn-all" title="Tampilkan semua data" @click="showAll">
          <i class="fa-solid fa-asterisk"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="cf-modal-body">
        <div v-if="loading" class="cf-modal-loading">
          <span class="cf-spinner"></span> Memuat data...
        </div>
        <template v-else>
          <div v-if="rows.length > 0" ref="tableHost" class="cf-modal-table" v-html="tableHtml"></div>
          <div v-else class="cf-modal-empty">
            <i class="fa-regular fa-folder-open"></i>
            <p>Data tidak ditemukan</p>
          </div>
          <div ref="pagerHost" class="cf-modal-pager" v-html="pagerHtml"></div>
        </template>
      </div>

      <!-- Footer (hanya untuk multi-select) -->
      <div class="cf-modal-footer">
        <span v-if="multiSelect" class="cf-modal-count">{{ checkedCount }} dipilih</span>
        <span v-else></span>
        <div class="cf-modal-footer-actions">
          <button type="button" class="cf-modal-btn cf-modal-btn-cancel" @click="close">Tutup</button>
          <button
            v-if="multiSelect"
            type="button"
            class="cf-modal-btn cf-modal-btn-choose"
            @click="confirmMulti"
          >
            <i class="fa-solid fa-check"></i> Pilih ({{ checkedCount }})
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue';

/* ── State ──────────────────────────────────────────────────────────── */
const visible    = ref(false);
const loading    = ref(false);
const title      = ref('Pilih Data');
const placeholder = ref('Ketik untuk mencari, atau * untuk semua...');
const searchText = ref('');
const rows       = ref([]);
const fnReady    = ref(false);

const tableHost  = ref(null);
const pagerHost  = ref(null);
const searchInput = ref(null);

const page       = ref(1);
const lastPage   = ref(1);

/* Konfigurasi yang diberikan parent saat open() */
const cfg = reactive({
  headers:      [],
  chunks:       [],
  actionParams: [],
  multiSelect:  false,
  fetch:        null,   // async (search, page) => { rows, currentPage, lastPage }
  onChoose:     null    // (selection | selections[]) => void
});

const multiSelect = computed(() => cfg.multiSelect);

/* Penyimpan pilihan multi-select lintas halaman: key = id (param pertama) */
const selectedMap = reactive({});
const checkedCount = computed(() => Object.keys(selectedMap).length);

/* ── HTML builder (Function_Path) ───────────────────────────────────── */
const tableHtml = computed(() => {
  if (!fnReady.value || rows.value.length === 0) return '';
  const actionType = cfg.multiSelect ? ['check'] : ['choose'];
  return window.tableModal(
    cfg.headers, cfg.chunks, rows.value,
    true, actionType, cfg.actionParams
  );
});

const pagerHtml = computed(() => {
  if (!fnReady.value || lastPage.value <= 1) return '';
  return window.loadModalPagination({ current_page: page.value, last_page: lastPage.value });
});

/* ── Tunggu Function_Path siap (dimuat global di App.vue) ───────────── */
const waitForFunctions = () => new Promise((resolve) => {
  const ready = () => window.tableModal && window.loadModalPagination && window.jQuery;
  if (ready()) return resolve();
  const timer = setInterval(() => { if (ready()) { clearInterval(timer); resolve(); } }, 50);
});

/* ── Parse value tombol/checkbox ("id|code|name") → objek per actionParam ── */
const parseValue = (valStr) => {
  const parts = String(valStr).split('|');
  const obj = {};
  cfg.actionParams.forEach((key, i) => { obj[key] = parts[i] ?? ''; });
  return obj;
};

/* ── Fetch data dari server ─────────────────────────────────────────── */
const runSearch = async (toPage = 1) => {
  if (!cfg.fetch) return;
  loading.value = true;
  try {
    // "*" = tampilkan semua (filter dikosongkan agar server kembalikan semua)
    const term = searchText.value.trim() === '*' ? '' : searchText.value.trim();
    const result = await cfg.fetch(term, toPage);
    rows.value     = result?.rows || [];
    page.value     = result?.currentPage || toPage;
    lastPage.value = result?.lastPage || 1;
  } catch (_) {
    rows.value = [];
    page.value = 1;
    lastPage.value = 1;
  } finally {
    loading.value = false;
  }
  await nextTick();
  bindTableEvents();
  bindPagerEvents();
};

const showAll = () => { searchText.value = '*'; runSearch(1); };

/* ── Bind event tombol/checkbox hasil tableModal → handler Vue ──────── */
const bindTableEvents = () => {
  const $ = window.jQuery;
  if (!$ || !tableHost.value) return;

  const $host = $(tableHost.value).off('.cfModal');

  if (cfg.multiSelect) {
    // Pulihkan status checked untuk item yang sudah dipilih (lintas halaman)
    $host.find('input[name="checkChoose[]"]').each(function () {
      const id = String($(this).val()).split('|')[0];
      $(this).prop('checked', Object.prototype.hasOwnProperty.call(selectedMap, id));
    });
    // Toggle pilihan saat checkbox berubah
    $host.on('change.cfModal', 'input[name="checkChoose[]"]', function () {
      const val = String($(this).val());
      const id  = val.split('|')[0];
      if ($(this).is(':checked')) selectedMap[id] = parseValue(val);
      else delete selectedMap[id];
    });
  } else {
    // Single-select → klik tombol pilih
    $host.on('click.cfModal', 'button[name="btnChoose"]', function (e) {
      e.preventDefault();
      const selection = parseValue($(this).val());
      if (cfg.onChoose) cfg.onChoose(selection);
      close();
    });
  }
};

const bindPagerEvents = () => {
  const $ = window.jQuery;
  if (!$ || !pagerHost.value) return;
  $(pagerHost.value)
    .off('.cfModal')
    .on('click.cfModal', 'a.page-link[data-page]', function (e) {
      e.preventDefault();
      const p = parseInt($(this).attr('data-page'), 10);
      if (p >= 1 && p <= lastPage.value && p !== page.value) runSearch(p);
    });
};

/* ── Konfirmasi pilihan multi-select ────────────────────────────────── */
const confirmMulti = () => {
  if (cfg.onChoose) cfg.onChoose(Object.values(selectedMap));
  close();
};

/* ── API publik: open / close ───────────────────────────────────────── */
const open = async (options = {}) => {
  await waitForFunctions();
  fnReady.value = true;

  cfg.headers      = options.headers      || [];
  cfg.chunks       = options.chunks       || [];
  cfg.actionParams = options.actionParams || [];
  cfg.multiSelect  = !!options.multiSelect;
  cfg.fetch        = options.fetch        || null;
  cfg.onChoose     = options.onChoose     || null;

  title.value       = options.title       || 'Pilih Data';
  placeholder.value = options.placeholder || 'Ketik untuk mencari, atau * untuk semua...';
  searchText.value  = options.initialSearch ? String(options.initialSearch).trim() : '';

  // Reset pilihan; pra-isi untuk multi-select bila parent mengirim preselected
  Object.keys(selectedMap).forEach(k => delete selectedMap[k]);
  if (cfg.multiSelect && Array.isArray(options.preselected)) {
    options.preselected.forEach(item => {
      const id = String(item[cfg.actionParams[0]] ?? '');
      if (id) selectedMap[id] = item;
    });
  }

  rows.value = [];
  page.value = 1;
  lastPage.value = 1;
  visible.value = true;

  await nextTick();
  if (searchInput.value) searchInput.value.focus();
  runSearch(1);   // muat data awal (pakai initialSearch bila ada)
};

const close = () => {
  const $ = window.jQuery;
  if ($) {
    if (tableHost.value) $(tableHost.value).off('.cfModal');
    if (pagerHost.value) $(pagerHost.value).off('.cfModal');
  }
  visible.value = false;
  rows.value = [];
  searchText.value = '';
};

onBeforeUnmount(close);

defineExpose({ open, close });
</script>

<style scoped>
.cf-modal-overlay {
  position: fixed; inset: 0; z-index: 11000;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: cfFade 0.15s ease;
}
@keyframes cfFade { from { opacity: 0; } to { opacity: 1; } }

.cf-modal-box {
  background: #fff; border-radius: 14px;
  width: 100%; max-width: 640px;
  max-height: 88vh; display: flex; flex-direction: column;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.3);
  animation: cfSlide 0.18s ease;
}
@keyframes cfSlide { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

.cf-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #edf2f7;
}
.cf-modal-title { margin: 0; font-size: 17px; font-weight: 700; color: #2d3748; }
.cf-modal-x { border: none; background: none; font-size: 18px; color: #a0aec0; cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px; transition: all .15s; }
.cf-modal-x:hover { background: #fed7d7; color: #c53030; }

.cf-modal-search { display: flex; gap: 8px; padding: 14px 20px; border-bottom: 1px solid #edf2f7; }
.cf-modal-search-input {
  flex: 1; padding: 9px 12px; font-size: 14px;
  border: 1px solid #cbd5e0; border-radius: 8px; outline: none; transition: border-color .2s;
}
.cf-modal-search-input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,.15); }

.cf-modal-btn { border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; padding: 9px 14px; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
.cf-modal-btn-search { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; }
.cf-modal-btn-search:hover { opacity: .9; }
.cf-modal-btn-all { background: #edf2f7; color: #4a5568; }
.cf-modal-btn-all:hover { background: #e2e8f0; }

.cf-modal-body { padding: 8px 20px 4px; overflow-y: auto; flex: 1; }
.cf-modal-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: #718096; font-size: 14px; }
.cf-spinner { width: 18px; height: 18px; border: 2px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: cfSpin .7s linear infinite; }
@keyframes cfSpin { to { transform: rotate(360deg); } }

.cf-modal-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: #a0aec0; }
.cf-modal-empty i { font-size: 36px; }
.cf-modal-empty p { margin: 0; font-size: 14px; }

.cf-modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid #edf2f7; gap: 12px; }
.cf-modal-count { font-size: 13px; font-weight: 600; color: #667eea; }
.cf-modal-footer-actions { display: flex; gap: 8px; margin-left: auto; }
.cf-modal-btn-cancel { background: #fff; border: 1px solid #e2e8f0; color: #4a5568; }
.cf-modal-btn-cancel:hover { background: #f7fafc; }
.cf-modal-btn-choose { background: #38a169; color: #fff; }
.cf-modal-btn-choose:hover { background: #2f855a; }

/* ── Tabel hasil window.tableModal (Bootstrap classes, global) ──────── */
.cf-modal-table :deep(.table) { font-size: 13.5px; color: #4a5568; margin: 0 !important; }
.cf-modal-table :deep(.table thead th) {
  background: #f8fafc !important; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em; color: #718096;
  padding: 11px 12px; border: none !important; border-bottom: 2px solid #e2e8f0 !important; white-space: nowrap;
}
.cf-modal-table :deep(.table tbody td) { padding: 10px 12px; border: none !important; border-bottom: 1px solid #f0f4f8 !important; vertical-align: middle; }
.cf-modal-table :deep(.table-hover tbody tr:hover td) { background: #f7f9fc !important; }
.cf-modal-table :deep(.badge.bg-success) { background: #c6f6d5 !important; color: #22543d !important; }
.cf-modal-table :deep(.badge.bg-warning) { background: #fefcbf !important; color: #744210 !important; }
.cf-modal-table :deep(.badge.bg-danger)  { background: #fed7d7 !important; color: #742a2a !important; }
.cf-modal-table :deep(.btn-success) { background: #38a169 !important; border-color: #38a169 !important; }
.cf-modal-table :deep(.form-check-input) { width: 18px; height: 18px; cursor: pointer; }

.cf-modal-pager { margin: 10px 0 4px; }
.cf-modal-pager :deep(.pagination) { margin: 0; flex-wrap: wrap; gap: 4px; }
.cf-modal-pager :deep(.page-link) { color: #667eea; border-radius: 6px; font-size: 13px; }
.cf-modal-pager :deep(.page-item.active .page-link) { background: #667eea; border-color: #667eea; color: #fff; }

@media (max-width: 576px) {
  .cf-modal-search { flex-wrap: wrap; }
  .cf-modal-search-input { min-width: 140px; }
}
</style>
