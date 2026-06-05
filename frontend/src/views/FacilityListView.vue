<template>
  <section class="facility-list-section">
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

      <!-- Filter & Search -->
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
        <div class="category-wrapper">
          <select v-model="filterCategory" class="filter-select" @change="loadData(1)">
            <option value="">Semua Kategori</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
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
        <p>Memuat data fasilitas...</p>
      </div>

      <!-- Table -->
      <div v-else class="table-wrapper">
        <table class="facility-table" v-if="facilities.length > 0">
          <thead>
            <tr>
              <th class="col-no">No</th>
              <th class="col-name">Nama Fasilitas</th>
              <th class="col-category">Kategori</th>
              <th class="col-icon">Icon</th>
              <th class="col-status">Status</th>
              <th class="col-action">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="facility in facilities" :key="facility.facility_id" :class="{ 'row-disabled': facility.status === 2 }">
              <td class="col-no">{{ facility.no }}</td>
              <td class="col-name">
                <div class="facility-name">{{ facility.name }}</div>
                <div v-if="facility.description" class="facility-desc">{{ facility.description }}</div>
              </td>
              <td class="col-category">
                <span v-if="facility.category" class="badge-category">{{ facility.category }}</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="col-icon">
                <span v-if="facility.icon" class="facility-icon">{{ facility.icon }}</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="col-status">
                <span :class="['badge-status', facility.status === 1 ? 'badge-aktif' : 'badge-disabled']">
                  {{ facility.status === 1 ? 'Aktif' : 'Disabled' }}
                </span>
              </td>
              <td class="col-action">
                <div class="action-buttons">
                  <!-- Edit -->
                  <router-link
                    :to="`/facility/edit/${facility.facility_id}`"
                    class="btn-action btn-edit"
                    title="Edit fasilitas"
                  >
                    ✏️ Edit
                  </router-link>

                  <!-- Toggle Aktif/Disabled -->
                  <button
                    class="btn-action"
                    :class="facility.status === 1 ? 'btn-disable' : 'btn-enable'"
                    :title="facility.status === 1 ? 'Nonaktifkan fasilitas' : 'Aktifkan fasilitas'"
                    :disabled="actionLoading === facility.facility_id"
                    @click="handleToggleStatus(facility)"
                  >
                    <span v-if="actionLoading === facility.facility_id" class="spinner-sm"></span>
                    <span v-else>{{ facility.status === 1 ? '🚫 Disable' : '✅ Aktifkan' }}</span>
                  </button>

                  <!-- Delete -->
                  <button
                    class="btn-action btn-delete"
                    title="Hapus fasilitas"
                    :disabled="actionLoading === facility.facility_id"
                    @click="handleDelete(facility)"
                  >
                    🗑️ Hapus
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-else class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Belum ada fasilitas yang terdaftar</p>
          <router-link to="/facility/add" class="btn-add-empty">+ Tambah Fasilitas Pertama</router-link>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="pagination-wrapper">
        <div class="pagination-info">
          Menampilkan {{ (pagination.page - 1) * pagination.pageSize + 1 }}–{{ Math.min(pagination.page * pagination.pageSize, pagination.total) }}
          dari {{ pagination.total }} fasilitas
        </div>
        <div class="pagination-controls">
          <button
            class="page-btn"
            :disabled="!pagination.hasPrevPage"
            @click="loadData(pagination.page - 1)"
            title="Halaman sebelumnya"
          >
            ‹
          </button>

          <button
            v-for="p in pageNumbers"
            :key="p"
            class="page-btn"
            :class="{ 'page-btn-active': p === pagination.page, 'page-btn-ellipsis': p === '...' }"
            :disabled="p === '...'"
            @click="p !== '...' && loadData(p)"
          >
            {{ p }}
          </button>

          <button
            class="page-btn"
            :disabled="!pagination.hasNextPage"
            @click="loadData(pagination.page + 1)"
            title="Halaman berikutnya"
          >
            ›
          </button>
        </div>
      </div>

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
import { ref, reactive, computed, onMounted } from 'vue';
import { toast } from 'vue3-toastify';
import {
  getFacilityList,
  getFacilityCategories,
  toggleFacilityStatus,
  deleteFacility
} from '../services/facilityApi';

/* ── State ──────────────────────────────────────────────────────── */
const facilities    = ref([]);
const categories    = ref([]);
const isLoading     = ref(false);
const actionLoading = ref(null);
const search        = ref('');
const filterCategory = ref('');
let   searchTimer   = null;

const pagination = reactive({
  total:      0,
  page:       1,
  pageSize:   10,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false
});

const alert = reactive({ type: '', message: '' });

const modal = reactive({
  show:         false,
  icon:         '',
  title:        '',
  desc:         '',
  confirmText:  '',
  confirmClass: '',
  loading:      false,
  onConfirm:    () => {}
});

/* ── Computed ───────────────────────────────────────────────────── */
const pageNumbers = computed(() => {
  const total = pagination.totalPages;
  const cur   = pagination.page;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  if (cur <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (cur >= total - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    for (let i = cur - 1; i <= cur + 1; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  }
  return pages;
});

/* ── Helpers ────────────────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

const openModal = (opts) => Object.assign(modal, { show: true, loading: false, ...opts });
const closeModal = () => { if (!modal.loading) modal.show = false; };

/* ── Data loading ───────────────────────────────────────────────── */
const loadData = async (page = 1) => {
  isLoading.value = true;
  clearAlert();
  try {
    const result = await getFacilityList({
      page,
      search:   search.value,
      category: filterCategory.value
    });

    if (result?.isSuccess === 1) {
      facilities.value = result.data.response.facilities || [];
      Object.assign(pagination, result.data.response.pagination || {});
    } else {
      setAlert('danger', result?.data?.message || 'Gagal memuat data');
    }
  } catch (err) {
    if (err?.response?.status === 401) return; // interceptor sudah redirect ke /login
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data fasilitas';
    setAlert('danger', msg);
  } finally {
    isLoading.value = false;
  }
};

const loadCategories = async () => {
  try {
    const result = await getFacilityCategories();
    if (result?.isSuccess === 1) {
      categories.value = result.data.response.categories || [];
    }
  } catch (_) {}
};

const onSearchInput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadData(1), 400);
};

/* ── Toggle status ──────────────────────────────────────────────── */
const handleToggleStatus = (facility) => {
  const isActive = facility.status === 1;
  openModal({
    icon:         isActive ? '🚫' : '✅',
    title:        isActive ? 'Nonaktifkan Fasilitas?' : 'Aktifkan Fasilitas?',
    desc:         `Fasilitas "${facility.name}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
    confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
    confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
    onConfirm:    async () => {
      modal.loading   = true;
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
        modal.loading       = false;
        modal.show          = false;
        actionLoading.value = null;
      }
    }
  });
};

/* ── Delete ─────────────────────────────────────────────────────── */
const handleDelete = (facility) => {
  openModal({
    icon:         '🗑️',
    title:        'Hapus Fasilitas?',
    desc:         `Fasilitas "${facility.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
    confirmText:  'Ya, Hapus',
    confirmClass: 'btn-confirm-danger',
    onConfirm:    async () => {
      modal.loading       = true;
      actionLoading.value = facility.facility_id;
      try {
        const result = await deleteFacility(facility.facility_id);
        if (result?.isSuccess === 1) {
          toast.success(result.data.message || 'Fasilitas berhasil dihapus');
          const newPage = facilities.value.length === 1 && pagination.page > 1
            ? pagination.page - 1
            : pagination.page;
          await loadData(newPage);
          await loadCategories();
        } else {
          toast.error(result?.data?.message || 'Gagal menghapus fasilitas');
        }
      } catch (err) {
        toast.error(err?.response?.data?.data?.message || 'Gagal menghapus fasilitas');
      } finally {
        modal.loading       = false;
        modal.show          = false;
        actionLoading.value = null;
      }
    }
  });
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(() => {
  loadData(1);
  loadCategories();
});
</script>

<style scoped>
.facility-list-section {
  min-height: calc(100vh - 80px);
  padding: 36px 0 60px;
  background: #f5f7fa;
}

/* ── Header ─────────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.page-header-left h2 {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 4px;
}

.page-header-left p {
  font-size: 14px;
  color: #718096;
  margin: 0;
}

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

/* ── Filter bar ─────────────────────────────────────────────────── */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-wrapper { flex: 1; min-width: 200px; }

.search-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.filter-select {
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  background: white;
  min-width: 160px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-select:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

/* ── Alert ──────────────────────────────────────────────────────── */
.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.alert-danger  { background: #fed7d7; color: #742a2a; border: 1px solid #feb2b2; }
.alert-success { background: #c6f6d5; color: #22543d; border: 1px solid #9ae6b4; }
.alert-warning { background: #fefcbf; color: #744210; border: 1px solid #faf089; }

.alert-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  line-height: 1;
  padding: 0 4px;
}

.alert-close:hover { opacity: 1; }

/* ── Loading ────────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #718096;
  gap: 16px;
}

.spinner-lg {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Table ──────────────────────────────────────────────────────── */
.table-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
  overflow: hidden;
}

.facility-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.facility-table thead tr {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.facility-table th {
  padding: 14px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  white-space: nowrap;
}

.facility-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.facility-table tbody tr:hover { background: #f8f9ff; }
.facility-table tbody tr:last-child { border-bottom: none; }

.facility-table td {
  padding: 14px 16px;
  vertical-align: middle;
  color: #2d3748;
}

.row-disabled { opacity: 0.6; }

.col-no       { width: 52px; text-align: center; font-weight: 600; color: #a0aec0; }
.col-name     { min-width: 160px; }
.col-category { width: 130px; }
.col-icon     { width: 80px; text-align: center; }
.col-status   { width: 100px; text-align: center; }
.col-action   { width: 260px; }

.facility-name { font-weight: 600; color: #2d3748; }
.facility-desc { font-size: 12px; color: #718096; margin-top: 2px; }
.facility-icon { font-size: 20px; }

.badge-category {
  display: inline-block;
  padding: 3px 10px;
  background: #ebf4ff;
  color: #2b6cb0;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.badge-status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.badge-aktif    { background: #c6f6d5; color: #22543d; }
.badge-disabled { background: #fed7d7; color: #742a2a; }

.text-muted { color: #a0aec0; font-size: 13px; }

/* ── Action buttons ─────────────────────────────────────────────── */
.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  text-decoration: none;
  white-space: nowrap;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-edit   { background: #ebf4ff; color: #2b6cb0; }
.btn-edit:hover:not(:disabled) { background: #bee3f8; color: #1a365d; }

.btn-disable { background: #fefcbf; color: #744210; }
.btn-disable:hover:not(:disabled) { background: #faf089; }

.btn-enable  { background: #c6f6d5; color: #22543d; }
.btn-enable:hover:not(:disabled)  { background: #9ae6b4; }

.btn-delete  { background: #fed7d7; color: #742a2a; }
.btn-delete:hover:not(:disabled)  { background: #feb2b2; }

/* ── Empty state ────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #718096;
  gap: 12px;
}

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

/* ── Pagination ─────────────────────────────────────────────────── */
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-info {
  font-size: 13px;
  color: #718096;
}

.pagination-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #4a5568;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled):not(.page-btn-ellipsis) {
  background: #ebf4ff;
  border-color: #667eea;
  color: #667eea;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn-active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-color: transparent;
  color: white;
}

.page-btn-active:hover {
  background: linear-gradient(135deg, #667eea, #764ba2) !important;
  color: white !important;
}

.page-btn-ellipsis {
  cursor: default;
  border-color: transparent;
  background: none;
}

/* ── Modal ──────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.modal-box {
  background: white;
  border-radius: 16px;
  padding: 36px 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}

.modal-icon  { font-size: 48px; margin-bottom: 12px; }
.modal-title { font-size: 20px; font-weight: 700; color: #2d3748; margin: 0 0 10px; }
.modal-desc  { font-size: 14px; color: #718096; margin: 0 0 24px; line-height: 1.6; }

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.btn-modal-cancel {
  padding: 10px 24px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #4a5568;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 100px;
}

.btn-modal-cancel:hover:not(:disabled) { background: #f7fafc; }
.btn-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-modal-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 100px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: white;
}

.btn-modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-confirm-danger  { background: #e53e3e; }
.btn-confirm-danger:hover:not(:disabled) { background: #c53030; }

.btn-confirm-success { background: #38a169; }
.btn-confirm-success:hover:not(:disabled) { background: #2f855a; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .facility-list-section { padding: 24px 0 40px; }

  .facility-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }

  .col-action { width: auto; }

  .action-buttons { flex-direction: column; gap: 4px; }

  .btn-action { width: 100%; justify-content: center; }

  .pagination-wrapper { flex-direction: column; align-items: flex-start; }

  .modal-box { padding: 28px 20px; }
}
</style>
