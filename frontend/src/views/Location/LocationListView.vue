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
        <!-- Table -->
        <div v-if="locations.length > 0" ref="tableHost" class="cf-table-host"
          v-html="tableHtml">
        </div>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📍</div>
          <p>Belum ada lokasi yang terdaftar</p>
          <router-link to="/location/add" class="btn-add-empty">+ Tambah Lokasi Pertama</router-link>
        </div>

        <!-- Pagination -->
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
  const tableHtml     = ref('');
  const pagerHtml     = ref('');

  const alert = reactive({ type: '', message: '' });

  const modal = reactive({
    show: false,
    title: '',
    desc: '',
    icon: '',
    confirmText: '',
    confirmClass: '',
    loading: false,
    onConfirm: null,
    actionType: null,
    targetId: null
  });

  /* ── Computed ───────────────────────────────────────────────────── */
  const isActionPending = computed(() => !!actionLoading.value);

  /* ── Helpers ────────────────────────────────────────────────────── */
  const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
  const clearAlert = () => { alert.type = ''; alert.message = ''; };

  const openModal = (opts) => {
    modal.title        = opts.title;
    modal.desc         = opts.desc;
    modal.icon         = opts.icon;
    modal.confirmText  = opts.confirmText;
    modal.confirmClass = opts.confirmClass;
    modal.actionType   = opts.actionType;
    modal.targetId     = opts.targetId;
    modal.loading      = false;
    modal.onConfirm    = opts.onConfirm;
    modal.show         = true;
  };

  const closeModal = () => {
    if (!modal.loading) modal.show = false;
  };

  /* ── Data loading ────────────────────────────────────────────────── */
  const loadLocations = async () => {
    isLoading.value = true;
    clearAlert();
    try {
      const result = await getLocationList();
      if (result?.isSuccess === 1) {
        locations.value = result.data.response.locations || [];
        await buildTable();
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data lokasi');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      const msg = err?.response?.data?.data?.message || 'Gagal memuat data lokasi';
      setAlert('danger', msg);
    } finally {
      isLoading.value = false;
    }
  };

  /* ── Search ──────────────────────────────────────────────────────── */
  const onSearchInput = () => {
    if (fnReady.value && window.searchTableData) {
      window.searchTableData(search.value);
    }
  };

  /* ── Table building ──────────────────────────────────────────────── */
  const buildTable = async () => {
    if (!window.tableModal) {
      fnReady.value = false;
      return;
    }

    const columns = [
      { key: 'location_id', label: 'ID' },
      { key: 'name', label: 'Nama Lokasi' },
      { key: 'status', label: 'Status', type: 'badge' },
      { key: 'created_by_name', label: 'Dibuat Oleh' },
      { key: 'action', label: 'Aksi' }
    ];

    const data = locations.value.map(loc => ({
      location_id: loc.location_id,
      name: loc.name,
      status: loc.status === 1 ? 'aktif' : 'disabled',
      created_by_name: loc.created_by_name || loc.created_by || '—',
      action: `
        <div class="action-buttons">
          <router-link to="/location/${loc.location_id}" class="btn-action btn-edit" title="Edit">✏️</router-link>
          <button type="button" class="btn-action btn-delete" title="Delete" onclick="window.__triggerLocationAction('delete', '${loc.location_id}')">🗑️</button>
        </div>
      `,
      _rowId: loc.location_id
    }));

    tableHtml.value = window.tableModal({
      columns,
      data,
      searchable: true,
      sortable: true,
      paginate: false,
      onRowClick: (rowId) => {
        router.push(`/location/${rowId}`);
      }
    });

    await nextTick();
    fnReady.value = true;
  };

  /* ── Actions ─────────────────────────────────────────────────────── */
  window.__triggerLocationAction = (action, locationId) => {
    if (action === 'delete') {
      const location = locations.value.find(loc => loc.location_id === locationId);
      if (location) {
        openModal({
          title: 'Hapus Lokasi?',
          desc: `Lokasi "${location.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
          icon: '🗑️',
          confirmText: 'Ya, Hapus',
          confirmClass: 'btn-confirm-danger',
          actionType: 'delete',
          targetId: locationId,
          onConfirm: () => handleDelete(locationId)
        });
      }
    }
  };

  const handleDelete = async (locationId) => {
    modal.loading = true;
    try {
      const result = await deleteLocation(locationId);
      if (result?.isSuccess === 1) {
        toast.success(result.data.message || 'Lokasi berhasil dihapus');
        closeModal();
        await loadLocations();
      } else {
        toast.error(result?.data?.message || 'Gagal menghapus lokasi');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      toast.error(err?.response?.data?.data?.message || 'Gagal menghapus lokasi');
    } finally {
      modal.loading = false;
    }
  };

  /* ── Lifecycle ──────────────────────────────────────────────────── */
  onMounted(() => {
    loadLocations();
  });

  onBeforeUnmount(() => {
    delete window.__triggerLocationAction;
  });
</script>
