<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Developer Property</h2>
          <p>Kelola brand agensi/brokerage properti (Ray White, Brighton, Xavier Marks, dll.)</p>
        </div>
        <router-link to="/developer-property/add" class="btn-add">
          + Tambah Developer Property
        </router-link>
      </div>

      <!-- Search -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama developer property..."
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
        <p>Memuat data developer property...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="developerProperties.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">🏢</div>
          <p>Belum ada developer property yang terdaftar</p>
          <router-link to="/developer-property/add" class="btn-add-empty">
            + Tambah Developer Property Pertama
          </router-link>
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
    getDeveloperPropertyList,
    toggleDeveloperPropertyStatus,
    deleteDeveloperProperty
  } from '../../services/developerPropertyApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const developerProperties = ref([]);
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
    Pola identik dengan master lain (Facility/Location) — markup tabel &
    pagination dibangun window.tableModal()/loadModalPagination(), jadi cukup
    ganti 4 baris di bawah + endpoint API-nya.
  ──────────────────────────────────────────────────────────────────────────── */
  const TABLE_HEADERS = ['Nama Developer Property', 'Status'];
  const TABLE_CHUNKS  = ['name', 'status'];
  const ACTION_TYPES  = ['update', 'block', 'delete'];
  const ACTION_PARAMS = ['developer_property_id'];

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || developerProperties.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, developerProperties.value,
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
  const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
  const clearAlert = () => { alert.type = ''; alert.message = ''; };
  const openModal  = (opts) => Object.assign(modal, { show: true, loading: false, ...opts });
  const closeModal = () => { if (!modal.loading) modal.show = false; };
  const findByCode = (code) =>
    developerProperties.value.find(d => d.developer_property_id === code) || null;

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getDeveloperPropertyList({ page, search: search.value });
      if (result?.isSuccess === 1) {
        developerProperties.value = result.data.response.developerProperties || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return; // interceptor redirect ke /login
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data developer property');
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
  const handleToggleStatus = (row) => {
    const isActive = row.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Developer Property?' : 'Aktifkan Developer Property?',
      desc:         `Developer property "${row.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = row.developer_property_id;
        try {
          const result = await toggleDeveloperPropertyStatus(row.developer_property_id);
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
  const handleDelete = (row) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Developer Property?',
      desc:         `Developer property "${row.name}" akan dihapus. Agent yang masih memakainya harus dipindahkan dulu.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = row.developer_property_id;
        try {
          const result = await deleteDeveloperProperty(row.developer_property_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Developer property berhasil dihapus');
            const newPage = developerProperties.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus developer property');
          }
        } catch (err) {
          // 409 = masih dipakai agent (guard di controller). Pesannya informatif,
          // tampilkan apa adanya supaya admin tahu harus memindahkan agent dulu.
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus developer property');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Jembatan event: tombol HTML (dari tableModal) → handler Vue ────────────── */
  const bindTableEvents = () => {
    const $ = window.jQuery;
    if (!$ || !tableHost.value) return;

    $(tableHost.value)
      .off('.cfDevProp')
      .on('click.cfDevProp', 'button[name="btnUpdate"]', function () {
        router.push(`/developer-property/edit/${$(this).val()}`);
      })
      .on('click.cfDevProp', 'button[name="btnDelete"]', function () {
        const d = findByCode($(this).val());
        if (d) handleDelete(d);
      })
      .on('click.cfDevProp', 'button[name="btnBlock"]', function () {
        // value = developer_property_id + status (1 digit di belakang) → buang 1 char terakhir
        const d = findByCode(String($(this).val()).slice(0, -1));
        if (d) handleToggleStatus(d);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfDevProp')
      .on('click.cfDevProp', 'a.page-link[data-page]', function (e) {
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
    const $ = window.jQuery;
    if (!$) return;
    if (tableHost.value) $(tableHost.value).off('.cfDevProp');
    if (pagerHost.value) $(pagerHost.value).off('.cfDevProp');
  });
</script>
