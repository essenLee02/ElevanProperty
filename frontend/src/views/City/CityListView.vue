<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Kota</h2>
          <p>Kelola daftar kota yang terhubung ke provinsi dan negara</p>
        </div>
        <router-link to="/city/add" class="btn-add">
          + Tambah Kota
        </router-link>
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama kota..."
            class="search-input"
            @input="onSearchInput"
          />
        </div>
        <div class="select-wrapper">
          <select v-model="filterCountry" class="filter-select" @change="onCountryFilterChange">
            <option value="">Semua Negara</option>
            <option v-for="c in countryOptions" :key="c.country_id" :value="c.country_id">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="select-wrapper">
          <select v-model="filterProvince" class="filter-select" @change="loadData(1)">
            <option value="">Semua Provinsi</option>
            <option v-for="p in provinceOptions" :key="p.province_id" :value="p.province_id">
              {{ p.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Alert -->
      <div v-if="alert.message" :class="['alert', `alert-${alert.type}`]" role="alert">
        {{ alert.message }}
        <button class="alert-close" @click="clearAlert">×</button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner-lg"></div>
        <p>Memuat data kota...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="cities.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">🏙️</div>
          <p>Belum ada kota yang terdaftar</p>
          <router-link to="/city/add" class="btn-add-empty">+ Tambah Kota Pertama</router-link>
        </div>

        <!-- Pagination (dibangun oleh window.loadModalPagination — Function_Path) -->
        <div ref="pagerHost" class="cf-pager-host" v-html="pagerHtml"></div>
      </template>

    </div>

    <!-- Confirm Modal -->
    <div v-if="modal.show" class="modal-overlay" @click.self="closeModal">
      <div class="modal-box">
        <div class="modal-icon">{{ modal.icon }}</div>
        <h3 class="modal-title">{{ modal.title }}</h3>
        <p class="modal-desc">{{ modal.desc }}</p>
        <div class="modal-actions">
          <button class="btn-modal-cancel" @click="closeModal" :disabled="modal.loading">Batal</button>
          <button
            :class="['btn-modal-confirm', modal.confirmClass]"
            @click="modal.onConfirm"
            :disabled="modal.loading"
          >
            <span v-if="modal.loading" class="spinner-sm"></span>
            <span v-else>{{ modal.confirmText }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
  import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import { toast } from 'vue3-toastify';
  import {
    getCityList,
    toggleCityStatus,
    deleteCity
  } from '../../services/cityApi';
  import { getCountryOptions } from '../../services/countryApi';
  import { getProvinceOptions } from '../../services/provinceApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const cities          = ref([]);
  const countryOptions  = ref([]);
  const provinceOptions = ref([]);
  const isLoading       = ref(false);
  const actionLoading   = ref(null);
  const search          = ref('');
  const filterCountry   = ref('');
  const filterProvince  = ref('');
  const fnReady         = ref(false);        // true setelah Function_Path siap
  const tableHost       = ref(null);
  const pagerHost       = ref(null);
  let   searchTimer     = null;

  const pagination = reactive({
    total: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });

  const alert = reactive({ type: '', message: '' });

  const modal = reactive({
    show: false, icon: '', title: '', desc: '',
    confirmText: '', confirmClass: '', loading: false, onConfirm: () => {}
  });

  /* ── Konfigurasi tabel (CookieFast) ──────────────────────────────────────────
    Kolom "Provinsi"/"Negara" mengambil nama hasil join backend
    (field province_name & country_name).
  ──────────────────────────────────────────────────────────────────────────── */
  const TABLE_HEADERS = ['Provinsi', 'Negara', 'Nama Kota', 'Status'];        // judul kolom
  const TABLE_CHUNKS  = ['province_name', 'country_name', 'name', 'status'];  // key data per kolom
  const ACTION_TYPES  = ['update', 'block', 'delete'];                        // tombol aksi
  const ACTION_PARAMS = ['city_id'];                                          // param tombol (→ value)

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || cities.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, cities.value,
      true, ACTION_TYPES, ACTION_PARAMS
    );
  });

  const pagerHtml = computed(() => {
    if (!fnReady.value || pagination.totalPages <= 1) return '';
    return window.loadModalPagination({
      current_page: pagination.page,
      last_page:    pagination.totalPages
    });
  });

  /* ── Helpers ────────────────────────────────────────────────────── */
  const setAlert    = (type, message) => { alert.type = type; alert.message = message; };
  const clearAlert  = () => { alert.type = ''; alert.message = ''; };
  const openModal   = (opts) => Object.assign(modal, { show: true, loading: false, ...opts });
  const closeModal  = () => { if (!modal.loading) modal.show = false; };
  const findByCode  = (code) => cities.value.find(c => String(c.city_id) === String(code)) || null;

  /* ── Load options (negara & provinsi) untuk filter ──────────────── */
  const loadCountryOptions = async () => {
    try {
      const result = await getCountryOptions();
      if (result?.isSuccess === 1) countryOptions.value = result.data.response.countries || [];
    } catch (_) { /* non-fatal */ }
  };

  const loadProvinceOptions = async () => {
    try {
      const result = await getProvinceOptions(filterCountry.value || null);
      if (result?.isSuccess === 1) provinceOptions.value = result.data.response.provinces || [];
    } catch (_) { /* non-fatal */ }
  };

  const onCountryFilterChange = async () => {
    filterProvince.value = '';            // reset provinsi saat negara berubah
    await loadProvinceOptions();
    loadData(1);
  };

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getCityList({
        page,
        search:      search.value,
        country_id:  filterCountry.value  || undefined,
        province_id: filterProvince.value || undefined
      });
      if (result?.isSuccess === 1) {
        cities.value = result.data.response.cities || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data kota');
    } finally {
      isLoading.value = false;
    }
    await nextTick();
    bindTableEvents();
    bindPagerEvents();
  };

  const onSearchInput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadData(1), 400);
  };

  /* ── Aksi: toggle status (block/unblock) ────────────────────────── */
  const handleToggleStatus = (city) => {
    const isActive = city.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Kota?' : 'Aktifkan Kota?',
      desc:         `Kota "${city.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = city.city_id;
        try {
          const result = await toggleCityStatus(city.city_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Status berhasil diubah');
            await loadData(pagination.page);
          } else {
            toast.error(result?.data?.message || 'Gagal mengubah status');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal mengubah status');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Aksi: delete (soft delete → status 3) ──────────────────────── */
  const handleDelete = (city) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Kota?',
      desc:         `Kota "${city.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = city.city_id;
        try {
          const result = await deleteCity(city.city_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Kota berhasil dihapus');
            const newPage = cities.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus kota');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus kota');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Jembatan event: tombol HTML (dari tableModal) → handler Vue ── */
  const bindTableEvents = () => {
    const $ = window.jQuery;
    if (!$ || !tableHost.value) return;

    $(tableHost.value)
      .off('.cfCity')
      .on('click.cfCity', 'button[name="btnUpdate"]', function () {
        router.push(`/city/edit/${$(this).val()}`);
      })
      .on('click.cfCity', 'button[name="btnDelete"]', function () {
        const c = findByCode($(this).val());
        if (c) handleDelete(c);
      })
      .on('click.cfCity', 'button[name="btnBlock"]', function () {
        const c = findByCode(String($(this).val()).slice(0, -1));
        if (c) handleToggleStatus(c);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfCity')
      .on('click.cfCity', 'a.page-link[data-page]', function (e) {
        e.preventDefault();
        const p = parseInt($(this).attr('data-page'), 10);
        if (p >= 1 && p <= pagination.totalPages && p !== pagination.page) loadData(p);
      });
  };

  /* ── Tunggu Function_Path siap (dimuat global di App.vue) ────────── */
  const waitForFunctions = () => new Promise((resolve) => {
    const ready = () => window.tableModal && window.loadModalPagination && window.jQuery;
    if (ready()) return resolve();
    const timer = setInterval(() => { if (ready()) { clearInterval(timer); resolve(); } }, 50);
  });

  /* ── Lifecycle ──────────────────────────────────────────────────── */
  onMounted(async () => {
    await waitForFunctions();
    fnReady.value = true;
    await loadCountryOptions();
    await loadProvinceOptions();
    await loadData(1);
  });

  onBeforeUnmount(() => {
    const $ = window.jQuery;
    if (!$) return;
    if (tableHost.value) $(tableHost.value).off('.cfCity');
    if (pagerHost.value) $(pagerHost.value).off('.cfCity');
  });
</script>

<style scoped>
.master-list-section {
  min-height: calc(100vh - 80px);
  padding: 36px 0 60px;
  background: #f5f7fa;
}

/* ── Header ─────────────────────────────────────────────────────── */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.page-header-left h2 { font-size: 24px; font-weight: 700; color: #2d3748; margin: 0 0 4px; }
.page-header-left p  { font-size: 14px; color: #718096; margin: 0; }

.btn-add {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  font-size: 14px;
  border-radius: 8px;
  text-decoration: none;
  transition: opacity 0.2s;
  white-space: nowrap;
}
.btn-add:hover { opacity: 0.9; color: white; }

/* ── Filter ─────────────────────────────────────────────────────── */
.filter-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.search-wrapper { flex: 1; min-width: 180px; }
.select-wrapper { min-width: 180px; }

.search-input, .filter-select {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  background: white;
}
.search-input:focus, .filter-select:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15); }

/* ── Alert ──────────────────────────────────────────────────────── */
.alert { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
.alert-danger  { background: #fed7d7; color: #742a2a; border: 1px solid #feb2b2; }
.alert-success { background: #c6f6d5; color: #22543d; border: 1px solid #9ae6b4; }
.alert-warning { background: #fefcbf; color: #744210; border: 1px solid #faf089; }
.alert-close { background: none; border: none; font-size: 18px; cursor: pointer; color: inherit; opacity: 0.7; line-height: 1; padding: 0 4px; }
.alert-close:hover { opacity: 1; }

/* ── CookieFast table/pager host ────────────────────────────────── */
.cf-table-host { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.07); overflow: hidden; }
.cf-pager-host { margin-top: 16px; }

.cf-table-host :deep(.table-responsive) { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.cf-table-host :deep(.table) { font-size: 14px; color: #4a5568; border-collapse: collapse !important; margin: 0 !important; }

.cf-table-host :deep(.table thead th) {
  background: #f8fafc !important;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #718096;
  padding: 13px 16px;
  border: none !important;
  border-bottom: 2px solid #e2e8f0 !important;
  white-space: nowrap;
}
.cf-table-host :deep(.table tbody td) { padding: 12px 16px; border: none !important; border-bottom: 1px solid #f0f4f8 !important; vertical-align: middle; }
.cf-table-host :deep(.table tbody tr:last-child td) { border-bottom: none !important; }
.cf-table-host :deep(.table-hover tbody tr:hover td) { background: #f7f9fc !important; }
.cf-table-host :deep(.table-striped > tbody > tr:nth-of-type(odd) > *) { background-color: transparent !important; }

.cf-table-host :deep(.badge) { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.02em; }
.cf-table-host :deep(.badge.bg-success) { background: #c6f6d5 !important; color: #22543d !important; }
.cf-table-host :deep(.badge.bg-warning) { background: #fefcbf !important; color: #744210 !important; }
.cf-table-host :deep(.badge.bg-danger)  { background: #fed7d7 !important; color: #742a2a !important; }

/* ── Loading / Empty ────────────────────────────────────────────── */
.loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; color: #718096; gap: 12px; }
.empty-icon { font-size: 48px; }
.empty-state p { margin: 0; font-size: 15px; }

.btn-add-empty {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  font-size: 14px;
  border-radius: 8px;
  text-decoration: none;
  margin-top: 8px;
}
.btn-add-empty:hover { opacity: 0.9; color: white; }

.spinner-lg { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.7s linear infinite; }
.spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Modal ──────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
.modal-box { background: white; border-radius: 16px; padding: 36px 32px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: modalIn 0.2s ease; }
@keyframes modalIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
.modal-icon  { font-size: 48px; margin-bottom: 12px; }
.modal-title { font-size: 20px; font-weight: 700; color: #2d3748; margin: 0 0 10px; }
.modal-desc  { font-size: 14px; color: #718096; margin: 0 0 24px; line-height: 1.6; }
.modal-actions { display: flex; gap: 10px; justify-content: center; }

.btn-modal-cancel { padding: 10px 24px; border: 1px solid #e2e8f0; background: white; color: #4a5568; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; min-width: 100px; }
.btn-modal-cancel:hover:not(:disabled) { background: #f7fafc; }
.btn-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-modal-confirm { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; min-width: 100px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: white; }
.btn-modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-confirm-danger  { background: #e53e3e; }
.btn-confirm-danger:hover:not(:disabled) { background: #c53030; }
.btn-confirm-success { background: #38a169; }
.btn-confirm-success:hover:not(:disabled) { background: #2f855a; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .master-list-section { padding: 24px 0 40px; }
  .modal-box { padding: 28px 20px; }
  .cf-table-host :deep(.table thead th),
  .cf-table-host :deep(.table tbody td) { padding: 10px 12px; font-size: 13px; }
}
</style>
