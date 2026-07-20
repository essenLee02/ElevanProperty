<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="page-header">
        <div class="page-header-left">
          <h2>Master Properti</h2>
          <p>Kelola daftar properti (jual / sewa) beserta lokasi dan tipenya</p>
        </div>
        <router-link to="/property/add" class="btn-add">
          + Tambah Properti
        </router-link>
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input
            v-model="search"
            type="text"
            placeholder="Cari judul properti..."
            class="search-input"
            @input="onSearchInput"
          />
        </div>
        <div class="select-wrapper">
          <select v-model="filterTransaction" class="filter-select" @change="loadData(1)">
            <option value="">Semua Transaksi</option>
            <option v-for="t in TRANSACTION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="filter-building-wrapper">
          <button
            class="filter-building-toggle"
            @click="showBuildingFilter = !showBuildingFilter"
            :class="{ active: filterBuilding.length > 0 }"
          >
            {{ filterBuilding.length > 0 ? `Tipe (${filterBuilding.length})` : 'Semua Tipe' }}
            <i :class="['fa-solid', showBuildingFilter ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
          </button>
          <div v-if="showBuildingFilter" class="filter-building-dropdown">
            <div class="checkbox-group">
              <label v-for="b in BUILDING_TYPES" :key="b.value" class="checkbox-item">
                <input
                  type="checkbox"
                  :value="b.value"
                  :checked="filterBuilding.includes(b.value)"
                  @change="toggleBuildingType(b.value)"
                />
                <span>{{ b.label }}</span>
              </label>
            </div>
            <div class="filter-building-actions">
              <button v-if="filterBuilding.length > 0" class="btn-reset" @click="clearBuildingFilter">
                Hapus Filter
              </button>
              <button class="btn-apply" @click="applyBuildingFilter">
                Terapkan
              </button>
            </div>
          </div>
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
        <p>Memuat data properti...</p>
      </div>

      <template v-else>
        <!-- Table (dibangun oleh window.tableModal — Function_Path) -->
        <div v-if="properties.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">🏠</div>
          <p>Belum ada properti yang terdaftar</p>
          <router-link to="/property/add" class="btn-add-empty">+ Tambah Properti Pertama</router-link>
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
    getPropertyList,
    togglePropertyStatus,
    deleteProperty
  } from '../../services/propertyApi';

  const router = useRouter();

  /* ── Opsi tipe (selaras backend) ─────────────────────────────────── */
  const TRANSACTION_TYPES = [
    { value: 'Sale', label: 'Jual (Sale)' },
    { value: 'Rent', label: 'Sewa (Rent)' }
  ];
  const BUILDING_TYPES = [
    { value: 'house',          label: 'Rumah' },
    { value: 'apartment',      label: 'Apartemen' },
    { value: 'hotel',          label: 'Hotel' },
    { value: 'villa',          label: 'Villa' },
    { value: 'boarding_house', label: 'Kos' },
    { value: 'shophouse',      label: 'Ruko' },
    { value: 'office',         label: 'Kantor' },
    { value: 'warehouse',      label: 'Gudang' },
    { value: 'store',          label: 'Toko' },
    { value: 'condo',          label: 'Kondominium' },
    { value: 'mansion',        label: 'Mansion' },
    { value: 'others',         label: 'Lainnya' }
  ];
  const BUILDING_LABEL = Object.fromEntries(BUILDING_TYPES.map(b => [b.value, b.label]));

  /* ── State ──────────────────────────────────────────────────────── */
  const properties        = ref([]);
  const isLoading         = ref(false);
  const actionLoading     = ref(null);
  const search            = ref('');
  const filterTransaction = ref('');
  const filterBuilding    = ref([]);          // Multi-select: array of building types
  const showBuildingFilter = ref(false);      // Dropdown toggle untuk checkbox group
  const fnReady           = ref(false);        // true setelah Function_Path siap
  const tableHost         = ref(null);
  const pagerHost         = ref(null);
  let   searchTimer       = null;

  const pagination = reactive({
    total: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });

  const alert = reactive({ type: '', message: '' });

  const modal = reactive({
    show: false, icon: '', title: '', desc: '',
    confirmText: '', confirmClass: '', loading: false, onConfirm: () => {}
  });

  /* ── Konfigurasi tabel (CookieFast) ──────────────────────────────────────────
    Kolom yang ditampilkan: Judul, Harga, Tipe Bangunan, Transaksi, Status.
    Nilai tampil (price_display dll.) disiapkan saat mapping data.
  ──────────────────────────────────────────────────────────────────────────── */
  const TABLE_HEADERS = ['Name', 'Harga', 'Tipe', 'Transaksi', 'Status'];
  const TABLE_CHUNKS  = ['title', 'price_display', 'building_type_label', 'transaction_type', 'status'];
  const ACTION_TYPES  = ['update', 'block', 'delete'];   // tombol aksi: edit, block, delete
  const ACTION_PARAMS = ['property_id'];                 // param tombol (→ value)

  /* ── HTML hasil function builder (reaktif terhadap data/pagination) ── */
  const tableHtml = computed(() => {
    if (!fnReady.value || properties.value.length === 0) return '';
    return window.tableModal(
      TABLE_HEADERS, TABLE_CHUNKS, properties.value,
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
  const findByCode  = (code) => properties.value.find(p => String(p.property_id) === String(code)) || null;

  const formatPrice = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const formatted = window.formatPriceDisplay(val);
    return formatted ? 'Rp ' + formatted : '-';
  };

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    isLoading.value = true;
    clearAlert();
    try {
      const params = {
        page,
        search:           search.value,
        transaction_type: filterTransaction.value || undefined,
        building_type:    filterBuilding.value.length > 0 ? filterBuilding.value.join(',') : undefined
      };
      const result = await getPropertyList(params);
      if (result?.isSuccess === 1) {
        const rows = result.data.response.properties || [];
        // Siapkan nilai tampil untuk kolom tipe bangunan (price_display sudah formatnya dari backend)
        properties.value = rows.map(p => ({
          ...p,
          price_display:       p.price_display || formatPrice(p.price),
          building_type_label: BUILDING_LABEL[p.building_type] || p.building_type || '-'
        }));
        Object.assign(pagination, result.data.response.pagination || {});
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data properti');
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

  const toggleBuildingType = (value) => {
    const index = filterBuilding.value.indexOf(value);
    if (index > -1) {
      filterBuilding.value.splice(index, 1);
    } else {
      filterBuilding.value.push(value);
    }
  };

  const clearBuildingFilter = () => {
    filterBuilding.value = [];
  };

  const applyBuildingFilter = async () => {
    showBuildingFilter.value = false;
    await loadData(1);
  };

  /* ── Aksi: toggle status (block/unblock) ────────────────────────── */
  const handleToggleStatus = (property) => {
    const isActive = property.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Properti?' : 'Aktifkan Properti?',
      desc:         `Properti "${property.title}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = property.property_id;
        try {
          const result = await togglePropertyStatus(property.property_id);
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
  const handleDelete = (property) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Properti?',
      desc:         `Properti "${property.title}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = property.property_id;
        try {
          const result = await deleteProperty(property.property_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Properti berhasil dihapus');
            const newPage = properties.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus properti');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus properti');
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
      .off('.cfProperty')
      .on('click.cfProperty', 'button[name="btnUpdate"]', function () {
        router.push(`/property/edit/${$(this).val()}`);
      })
      .on('click.cfProperty', 'button[name="btnDelete"]', function () {
        const p = findByCode($(this).val());
        if (p) handleDelete(p);
      })
      .on('click.cfProperty', 'button[name="btnBlock"]', function () {
        const p = findByCode(String($(this).val()).slice(0, -1));
        if (p) handleToggleStatus(p);
      });
  };

  const bindPagerEvents = () => {
    const $ = window.jQuery;
    if (!$ || !pagerHost.value) return;

    $(pagerHost.value)
      .off('.cfProperty')
      .on('click.cfProperty', 'a.page-link[data-page]', function (e) {
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
    if (tableHost.value) $(tableHost.value).off('.cfProperty');
    if (pagerHost.value) $(pagerHost.value).off('.cfProperty');
  });
</script>
