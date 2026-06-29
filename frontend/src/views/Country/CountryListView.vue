<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Negara</h2>
          <p>Kelola daftar negara untuk data wilayah properti</p>
        </div>
        <router-link to="/country/add" class="btn-add">
          + Tambah Negara
        </router-link>
      </div>

      <!-- Search -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama negara..."
            class="search-input"
            @input="onSearchInput"
          />
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
        <p>Memuat data negara...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="countries.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">🌍</div>
          <p>Belum ada negara yang terdaftar</p>
          <router-link to="/country/add" class="btn-add-empty">+ Tambah Negara Pertama</router-link>
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
    getCountryList,
    toggleCountryStatus,
    deleteCountry
  } from '../../services/countryApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const countries     = ref([]);
  const isLoading     = ref(false);
  const actionLoading = ref(null);
  const search        = ref('');
  const fnReady       = ref(false);        // true setelah Function_Path siap
  const tableHost     = ref(null);
  const pagerHost     = ref(null);
  let   searchTimer   = null;

  const pagination = reactive({
    total: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });

  const alert = reactive({ type: '', message: '' });

  const modal = reactive({
    show: false, icon: '', title: '', desc: '',
    confirmText: '', confirmClass: '', loading: false, onConfirm: () => {}
  });

  /* ── Konfigurasi tabel (CookieFast) ──────────────────────────────────────────
    Untuk membuat list view baru, cukup DUPLIKAT komponen ini dan ganti 4 baris
    di bawah + endpoint API-nya — markup tabel & pagination tidak perlu ditulis
    ulang karena dibangun oleh window.tableModal()/loadModalPagination().
  ──────────────────────────────────────────────────────────────────────────── */
  const TABLE_HEADERS = ['Nama Negara', 'Status'];   // judul kolom
  const TABLE_CHUNKS  = ['name', 'status'];          // key data per kolom
  const ACTION_TYPES  = ['update', 'block', 'delete'];        // tombol aksi
  const ACTION_PARAMS = ['country_id'];                       // param tombol (→ value)

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || countries.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, countries.value,
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
  const findByCode  = (code) => countries.value.find(c => String(c.country_id) === String(code)) || null;

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getCountryList({ page, search: search.value });
      if (result?.isSuccess === 1) {
        countries.value = result.data.response.countries || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return; // interceptor redirect ke /login
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data negara');
    } finally {
      isLoading.value = false;
    }
    // host di-render ulang tiap load (v-if/loading) → re-bind delegation (idempotent)
    await nextTick();
    bindTableEvents();
    bindPagerEvents();
  };

  const onSearchInput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadData(1), 400);
  };

  /* ── Aksi: toggle status (block/unblock) ────────────────────────── */
  const handleToggleStatus = (country) => {
    const isActive = country.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Negara?' : 'Aktifkan Negara?',
      desc:         `Negara "${country.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = country.country_id;
        try {
          const result = await toggleCountryStatus(country.country_id);
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
  const handleDelete = (country) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Negara?',
      desc:         `Negara "${country.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = country.country_id;
        try {
          const result = await deleteCountry(country.country_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Negara berhasil dihapus');
            const newPage = countries.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus negara');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus negara');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Jembatan event: tombol HTML (dari tableModal) → handler Vue ──────────────
    tableModal me-render <button name="btnUpdate|btnBlock|btnDelete" value="...">.
    Kita pakai event-delegation jQuery pada host element yang stabil, sehingga
    tetap bekerja walau v-html mengganti isi tabel saat data berubah.
  ──────────────────────────────────────────────────────────────────────────── */
  const bindTableEvents = () => {
    const $ = window.jQuery;
    if (!$ || !tableHost.value) return;

    $(tableHost.value)
      .off('.cfCountry')
      .on('click.cfCountry', 'button[name="btnUpdate"]', function () {
        router.push(`/country/edit/${$(this).val()}`);
      })
      .on('click.cfCountry', 'button[name="btnDelete"]', function () {
        const c = findByCode($(this).val());
        if (c) handleDelete(c);
      })
      .on('click.cfCountry', 'button[name="btnBlock"]', function () {
        // value = country_id + status (status 1 digit di belakang) → buang 1 char terakhir
        const c = findByCode(String($(this).val()).slice(0, -1));
        if (c) handleToggleStatus(c);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfCountry')
      .on('click.cfCountry', 'a.page-link[data-page]', function (e) {
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
    await loadData(1);   // loadData sudah mem-bind event setelah render
  });

  onBeforeUnmount(() => {
    const $ = window.jQuery;
    if (!$) return;
    if (tableHost.value) $(tableHost.value).off('.cfCountry');
    if (pagerHost.value) $(pagerHost.value).off('.cfCountry');
  });
</script>
