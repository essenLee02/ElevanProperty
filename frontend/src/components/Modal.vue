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
