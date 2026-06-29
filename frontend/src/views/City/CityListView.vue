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
  const TABLE_HEADERS = ['Nama Kota', 'Provinsi', 'Negara', 'Status'];        // judul kolom
  const TABLE_CHUNKS  = ['name', 'province_name', 'country_name', 'status'];  // key data per kolom
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
