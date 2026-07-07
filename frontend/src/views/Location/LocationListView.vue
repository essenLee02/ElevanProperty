<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Lokasi</h2>
          <p>Kelola daftar lokasi rujukan untuk pencarian properti</p>
        </div>
        <router-link to="/location/add" class="btn-add">
          + Tambah Lokasi
        </router-link>
      </div>

      <!-- Search -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama lokasi..."
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
        <p>Memuat data lokasi...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal) -->
        <div v-if="locations.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📍</div>
          <p>Belum ada lokasi yang terdaftar</p>
          <router-link to="/location/add" class="btn-add-empty">+ Tambah Lokasi Pertama</router-link>
        </div>

        <!-- Pagination (dibangun oleh window.loadModalPagination) -->
        <div ref="pagerHost" class="cf-pager-host" v-html="pagerHtml"></div>
      </template>

    </div>

    <!-- Confirm Modal -->
    <ConfirmModal
      :show="modal.show"
      :icon="modal.icon"
      :title="modal.title"
      :message="modal.desc"
      :confirm-text="modal.confirmText"
      :confirm-class="modal.confirmClass"
      :busy="modal.loading"
      @confirm="modal.onConfirm"
      @cancel="closeModal"
    />
  </section>
</template>

<script setup>
  import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import { toast } from 'vue3-toastify';
  import ConfirmModal from '../../components/ConfirmModal.vue';
  import {
    getLocationList,
    toggleLocationStatus,
    deleteLocation
  } from '../../services/locationApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const locations     = ref([]);
  const isLoading     = ref(false);
  const actionLoading = ref(null);
  const search        = ref('');
  const fnReady       = ref(false);
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

  /* ── Konfigurasi tabel (CookieFast) ────────────────────────────────── */
  const TABLE_HEADERS = ['Nama Lokasi', 'Status'];
  const TABLE_CHUNKS  = ['name', 'status'];
  const ACTION_TYPES  = ['update', 'block', 'delete'];
  const ACTION_PARAMS = ['location_id'];

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || locations.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, locations.value,
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
  const findById    = (id) => locations.value.find(loc => String(loc.location_id) === String(id)) || null;

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getLocationList({
        page,
        search: search.value
      });
      if (result?.isSuccess === 1) {
        locations.value = result.data.response.locations || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data lokasi');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data lokasi');
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

  /* ── Aksi: toggle status (aktif ↔ blocked) ──────────────────────── */
  const handleToggleStatus = (location) => {
    const isActive = location.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Lokasi?' : 'Aktifkan Lokasi?',
      desc:         `Lokasi "${location.name}" akan diubah menjadi ${isActive ? 'Blocked' : 'Active'}.`,
      confirmText:  isActive ? 'Ya, Block' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = location.location_id;
        try {
          const result = await toggleLocationStatus(location.location_id);
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
  const handleDelete = (location) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Lokasi?',
      desc:         `Lokasi "${location.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = location.location_id;
        try {
          const result = await deleteLocation(location.location_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Lokasi berhasil dihapus');
            const newPage = locations.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus lokasi');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus lokasi');
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
      .off('.cfLocation')
      .on('click.cfLocation', 'button[name="btnUpdate"]', function () {
        router.push(`/location/edit/${$(this).val()}`);
      })
      .on('click.cfLocation', 'button[name="btnBlock"]', function () {
        const locId = String($(this).val()).slice(0, -1);
        const loc = findById(locId);
        if (loc) handleToggleStatus(loc);
      })
      .on('click.cfLocation', 'button[name="btnDelete"]', function () {
        const loc = findById($(this).val());
        if (loc) handleDelete(loc);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfLocation')
      .on('click.cfLocation', 'a.page-link[data-page]', function (e) {
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
    await loadData(1);
  });

  onBeforeUnmount(() => {
    clearTimeout(searchTimer);
  });
</script>
