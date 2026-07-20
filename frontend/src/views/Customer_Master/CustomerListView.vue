<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Customer</h2>
          <p>Kelola customer — terdaftar otomatis oleh AI (saat summary WhatsApp) atau input manual</p>
        </div>
        <router-link to="/customer/add" class="btn-add">
          + Tambah Customer
        </router-link>
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari nama / nomor / email / ID customer..."
            class="search-input"
            @input="onSearchInput"
          />
        </div>
        <div class="select-wrapper">
          <select v-model="filterAi" class="filter-select" @change="loadData(1)">
            <option value="">Semua AI Response</option>
            <option value="ON">AI ON — dibalas AI</option>
            <option value="OFF">AI OFF — takeover manual</option>
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
        <p>Memuat data customer...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="customers.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">👥</div>
          <p>Belum ada customer yang terdaftar</p>
          <router-link to="/customer/add" class="btn-add-empty">+ Tambah Customer Pertama</router-link>
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
    getCustomerList,
    toggleCustomerStatus,
    deleteCustomer
  } from '../../services/customerApi';

  const router = useRouter();

  /* ── State ──────────────────────────────────────────────────────── */
  const customers     = ref([]);
  const isLoading     = ref(false);
  const actionLoading = ref(null);
  const search        = ref('');
  const filterAi      = ref('');
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

  /* ── Konfigurasi tabel (CookieFast) ────────────────────────────────
    ai_response ditampilkan sebagai kolom teks (ON/OFF); toggle detailnya
    dilakukan dari halaman edit customer.
  ──────────────────────────────────────────────────────────────────── */
  const TABLE_HEADERS = ['Nama', 'No. WhatsApp', 'Email', 'AI Response', 'Status'];
  const TABLE_CHUNKS  = ['name', 'phone', 'email', 'ai_response', 'status'];
  const ACTION_TYPES  = ['update', 'block', 'delete'];
  const ACTION_PARAMS = ['customer_id'];

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || customers.value.length === 0) return '';
    // Fallback tampilan: phone/email kosong → strip
    const rows = customers.value.map(c => ({
      ...c,
      phone: c.phone || '—',
      email: c.email || '—',
    }));
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, rows,
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
  const findByCode  = (code) => customers.value.find(c => String(c.customer_id) === String(code)) || null;

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getCustomerList({
        page,
        search:      search.value,
        ai_response: filterAi.value || undefined
      });
      if (result?.isSuccess === 1) {
        customers.value = result.data.response.customers || [];
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data customer');
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
  const handleToggleStatus = (customer) => {
    const isActive = customer.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Customer?' : 'Aktifkan Customer?',
      desc:         `Customer "${customer.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = customer.customer_id;
        try {
          const result = await toggleCustomerStatus(customer.customer_id);
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
  const handleDelete = (customer) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Customer?',
      desc:         `Customer "${customer.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = customer.customer_id;
        try {
          const result = await deleteCustomer(customer.customer_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Customer berhasil dihapus');
            const newPage = customers.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus customer');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus customer');
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
      .off('.cfCustomer')
      .on('click.cfCustomer', 'button[name="btnUpdate"]', function () {
        router.push(`/customer/edit/${$(this).val()}`);
      })
      .on('click.cfCustomer', 'button[name="btnDelete"]', function () {
        const c = findByCode($(this).val());
        if (c) handleDelete(c);
      })
      .on('click.cfCustomer', 'button[name="btnBlock"]', function () {
        const c = findByCode(String($(this).val()).slice(0, -1));
        if (c) handleToggleStatus(c);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfCustomer')
      .on('click.cfCustomer', 'a.page-link[data-page]', function (e) {
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
    if (tableHost.value) $(tableHost.value).off('.cfCustomer');
    if (pagerHost.value) $(pagerHost.value).off('.cfCustomer');
  });
</script>
