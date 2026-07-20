<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Fasilitas</h2>
          <p>Kelola daftar fasilitas yang tersedia untuk properti</p>
        </div>
        <router-link to="/facility/add" class="btn-add">
          + Tambah Fasilitas
        </router-link>
      </div>

      <!-- Search -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama fasilitas..."
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
        <p>Memuat data fasilitas...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="facilities.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Belum ada fasilitas yang terdaftar</p>
          <router-link to="/facility/add" class="btn-add-empty">+ Tambah Fasilitas Pertama</router-link>
        </div>

        <!-- Pagination (dibangun oleh window.loadModalPagination — Function_Path) -->
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
    getFacilityList,
    toggleFacilityStatus,
    deleteFacility
  } from '../../services/facilityApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const facilities    = ref([]);
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
  const TABLE_HEADERS = ['Nama Fasilitas', 'Status'];  // judul kolom
  const TABLE_CHUNKS  = ['name', 'status'];            // key data per kolom
  const ACTION_TYPES  = ['update', 'block', 'delete'];         // tombol aksi
  const ACTION_PARAMS = ['facility_id'];                       // param tombol (→ value)

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || facilities.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, facilities.value,
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
  const findByCode  = (code) => facilities.value.find(f => f.facility_id === code) || null;

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getFacilityList({ page, search: search.value });
      if (result?.isSuccess === 1) {
        facilities.value = result.data.response.facilities || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return; // interceptor redirect ke /login
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data fasilitas');
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
  const handleToggleStatus = (facility) => {
    const isActive = facility.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Fasilitas?' : 'Aktifkan Fasilitas?',
      desc:         `Fasilitas "${facility.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = facility.facility_id;
        try {
          const result = await toggleFacilityStatus(facility.facility_id);
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
  const handleDelete = (facility) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Fasilitas?',
      desc:         `Fasilitas "${facility.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = facility.facility_id;
        try {
          const result = await deleteFacility(facility.facility_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Fasilitas berhasil dihapus');
            const newPage = facilities.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus fasilitas');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus fasilitas');
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
      .off('.cfFacility')
      .on('click.cfFacility', 'button[name="btnUpdate"]', function () {
        router.push(`/facility/edit/${$(this).val()}`);
      })
      .on('click.cfFacility', 'button[name="btnDelete"]', function () {
        const f = findByCode($(this).val());
        if (f) handleDelete(f);
      })
      .on('click.cfFacility', 'button[name="btnBlock"]', function () {
        // value = facility_id + status (status 1 digit di belakang) → buang 1 char terakhir
        const f = findByCode(String($(this).val()).slice(0, -1));
        if (f) handleToggleStatus(f);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfFacility')
      .on('click.cfFacility', 'a.page-link[data-page]', function (e) {
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
    if (tableHost.value) $(tableHost.value).off('.cfFacility');
    if (pagerHost.value) $(pagerHost.value).off('.cfFacility');
  });
</script>
