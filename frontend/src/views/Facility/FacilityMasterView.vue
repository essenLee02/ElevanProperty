<template>
  <section class="facility-master-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-7 col-lg-8 col-md-10">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/facility" class="back-link">
              ← Kembali ke Daftar Fasilitas
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Fasilitas' : 'Tambah Fasilitas' }}</h2>
                <p>{{ isEditMode ? 'Perbarui informasi fasilitas' : 'Tambahkan fasilitas baru ke master data' }}</p>
              </div>
              <div v-if="isEditMode && form.facility_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.facility_id }}</span>
              </div>
            </div>

            <!-- Alert -->
            <div
              v-if="alert.message"
              :class="['alert', `alert-${alert.type}`]"
              role="alert"
            >
              {{ alert.message }}
            </div>

            <!-- Loading (edit mode — ambil data dulu) -->
            <div v-if="isLoadingDetail" class="loading-state">
              <div class="spinner-lg"></div>
              <p>Memuat data fasilitas...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- Nama Fasilitas -->
              <div class="form-group">
                <label for="name">Nama Fasilitas <span class="required">*</span></label>
                <input
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Contoh: Kolam Renang, AC, CCTV"
                  :disabled="isSubmitting"
                  maxlength="100"
                  required
                  autocomplete="off"
                />
                <p class="field-hint">Maksimal 100 karakter</p>
              </div>

              <!-- Icon -->
              <div class="form-group">
                <label for="icon">Icon</label>
                <div class="icon-input-wrapper">
                  <span class="icon-preview" v-if="form.icon">{{ form.icon }}</span>
                  <span class="icon-preview icon-placeholder" v-else>?</span>
                  <input
                    id="icon"
                    v-model.trim="form.icon"
                    type="text"
                    placeholder="Emoji atau class icon, contoh: 🏊 atau fa-wifi"
                    :disabled="isSubmitting"
                    maxlength="50"
                  />
                </div>
                <p class="field-hint">Opsional. Emoji direkomendasikan untuk tampilan yang lebih intuitif</p>
                <!-- Quick emoji picker -->
                <div class="quick-emoji">
                  <span
                    v-for="emoji in quickEmojis"
                    :key="emoji"
                    class="emoji-chip"
                    :class="{ 'emoji-selected': form.icon === emoji }"
                    @click="form.icon = form.icon === emoji ? '' : emoji"
                    :title="emoji"
                  >{{ emoji }}</span>
                </div>
              </div>

              <!-- Deskripsi -->
              <div class="form-group">
                <label for="description">Deskripsi</label>
                <textarea
                  id="description"
                  v-model.trim="form.description"
                  placeholder="Deskripsi singkat fasilitas (opsional)"
                  :disabled="isSubmitting"
                  maxlength="255"
                  rows="3"
                  autocomplete="off"
                ></textarea>
                <p class="field-hint">Opsional. Maksimal 255 karakter. Sisa: {{ 255 - (form.description || '').length }}</p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.facility_id" class="audit-info">
                <div class="audit-divider">
                  <span>Informasi Audit</span>
                </div>

                <div class="audit-grid">
                  <div class="audit-item">
                    <span class="audit-label">Dibuat oleh</span>
                    <span class="audit-value">{{ form.created_by_name || form.created_by || '—' }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Tanggal dibuat</span>
                    <span class="audit-value">{{ formatDate(form.created_date) }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Terakhir diubah oleh</span>
                    <span class="audit-value">{{ form.updated_by_name || form.updated_by || '—' }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Tanggal perubahan</span>
                    <span class="audit-value">{{ formatDate(form.updated_date) }}</span>
                  </div>
                </div>

                <!-- Status & Toggle -->
                <div class="status-bar">
                  <div class="status-info">
                    <span class="audit-label">Status saat ini</span>
                    <span :class="['badge-status', form.status === 1 ? 'badge-aktif' : 'badge-disabled']">
                      {{ form.status === 1 ? 'Aktif' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="status-actions">
                    <button
                      type="button"
                      class="btn-toggle-status"
                      :class="form.status === 1 ? 'btn-toggle-disable' : 'btn-toggle-enable'"
                      :disabled="isTogglingStatus || isDeleting"
                      @click="handleToggleStatus"
                    >
                      <span v-if="isTogglingStatus" class="spinner-sm"></span>
                      <span v-else>{{ form.status === 1 ? '🚫 Nonaktifkan' : '✅ Aktifkan' }}</span>
                    </button>
                    <button
                      type="button"
                      class="btn-delete-status"
                      :disabled="isTogglingStatus || isDeleting"
                      @click="openDeleteModal"
                    >
                      <span v-if="isDeleting" class="spinner-sm"></span>
                      <span v-else>🗑️ Hapus</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="form-actions">
                <router-link to="/facility" class="btn-cancel">
                  Batal
                </router-link>
                <button
                  type="submit"
                  class="btn-submit"
                  :disabled="isSubmitting || !hasChanges"
                >
                  <span v-if="isSubmitting">
                    <span class="spinner-sm"></span> Menyimpan...
                  </span>
                  <span v-else>{{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Fasilitas' }}</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <div v-if="deleteModal.show" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-box">
        <div class="modal-icon">🗑️</div>
        <h3 class="modal-title">Hapus Fasilitas?</h3>
        <p class="modal-desc">
          Fasilitas <strong>"{{ form.name }}"</strong> akan dihapus.
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div class="modal-actions">
          <button class="btn-modal-cancel" @click="closeDeleteModal" :disabled="isDeleting">Batal</button>
          <button class="btn-modal-confirm btn-confirm-danger" @click="handleDelete" :disabled="isDeleting">
            <span v-if="isDeleting" class="spinner-sm"></span>
            <span v-else>Ya, Hapus</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import {
  getFacilityDetail,
  insertFacility,
  updateFacility,
  toggleFacilityStatus,
  deleteFacility
} from '../../services/facilityApi';

const route  = useRoute();
const router = useRouter();

/* ── Mode detection ─────────────────────────────────────────────── */
const facilityId  = computed(() => route.params.facility_id || null);
const isEditMode  = computed(() => !!facilityId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail  = ref(false);
const isSubmitting     = ref(false);
const isTogglingStatus = ref(false);
const isDeleting       = ref(false);

const deleteModal = reactive({ show: false });

const form = reactive({
  facility_id:     '',
  name:            '',
  icon:            '',
  description:     '',
  status:          1,
  created_date:    '',
  created_by:      '',
  created_by_name: '',
  updated_date:    '',
  updated_by:      '',
  updated_by_name: ''
});

const originalForm = reactive({
  name:        '',
  icon:        '',
  description: ''
});

const alert = reactive({ type: '', message: '' });

/* ── Quick emoji list ────────────────────────────────────────────── */
const quickEmojis = [
  '❄️', '🚿', '🛁', '🏊', '🅿️', '📷', '🔒', '🌿',
  '🍽️', '🏋️', '🛗', '⚡', '📶', '🧺', '🛋️', '🔥'
];

/* ── Computed ───────────────────────────────────────────────────── */
const hasChanges = computed(() => {
  if (!isEditMode.value) {
    return !!form.name.trim();
  }
  return (
    form.name        !== originalForm.name        ||
    form.icon        !== originalForm.icon        ||
    form.description !== originalForm.description
  );
});

/* ── Helpers ────────────────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
};

const syncOriginal = () => {
  originalForm.name        = form.name;
  originalForm.icon        = form.icon;
  originalForm.description = form.description;
};

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getFacilityDetail(facilityId.value);
    if (result?.isSuccess === 1) {
      const f = result.data.response.facility;
      Object.assign(form, {
        facility_id:     f.facility_id     || '',
        name:            f.name            || '',
        icon:            f.icon            || '',
        description:     f.description     || '',
        status:          f.status          ?? 1,
        created_date:    f.created_date    || '',
        created_by:      f.created_by      || '',
        created_by_name: f.created_by_name || '',
        updated_date:    f.updated_date    || '',
        updated_by:      f.updated_by      || '',
        updated_by_name: f.updated_by_name || ''
      });
      syncOriginal();
    } else {
      setAlert('danger', result?.data?.message || 'Fasilitas tidak ditemukan');
      setTimeout(() => router.push('/facility'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return; // interceptor sudah redirect ke /login
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data fasilitas';
    setAlert('danger', msg);
    setTimeout(() => router.push('/facility'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.name.trim()) {
    setAlert('warning', 'Nama fasilitas wajib diisi');
    return;
  }

  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  isSubmitting.value = true;

  const payload = {
    name:        form.name,
    icon:        form.icon     || null,
    description: form.description || null
  };

  try {
    let result;
    if (isEditMode.value) {
      result = await updateFacility(facilityId.value, payload);
    } else {
      result = await insertFacility(payload);
    }

    if (result?.isSuccess === 1) {
      const msg = result.data.message || (isEditMode.value ? 'Fasilitas berhasil diperbarui' : 'Fasilitas berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const f = result.data.response.facility;
        Object.assign(form, {
          updated_date:    f.updated_date    || '',
          updated_by:      f.updated_by      || '',
          updated_by_name: f.updated_by_name || ''
        });
        syncOriginal();
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/facility');
      }
    } else {
      setAlert('danger', result?.data?.message || 'Gagal menyimpan data');
    }
  } catch (err) {
    const msg = err?.response?.data?.data?.message || err?.message || 'Terjadi kesalahan';
    setAlert('danger', msg);
  } finally {
    isSubmitting.value = false;
  }
};

/* ── Toggle status (dari halaman edit) ──────────────────────────── */
const handleToggleStatus = async () => {
  isTogglingStatus.value = true;
  try {
    const result = await toggleFacilityStatus(facilityId.value);
    if (result?.isSuccess === 1) {
      form.status = result.data.response.status;
      toast.success(result.data.message || 'Status berhasil diubah');
    } else {
      toast.error(result?.data?.message || 'Gagal mengubah status');
    }
  } catch (err) {
    toast.error(err?.response?.data?.data?.message || 'Gagal mengubah status');
  } finally {
    isTogglingStatus.value = false;
  }
};

/* ── Soft delete (status → 3) dari halaman edit ─────────────────── */
const openDeleteModal  = () => { deleteModal.show = true; };
const closeDeleteModal = () => { if (!isDeleting.value) deleteModal.show = false; };

const handleDelete = async () => {
  isDeleting.value = true;
  try {
    const result = await deleteFacility(facilityId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Fasilitas berhasil dihapus');
      deleteModal.show = false;
      router.push('/facility');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus fasilitas');
    }
  } catch (err) {
    if (err?.response?.status === 401) return; // interceptor handle redirect
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus fasilitas');
  } finally {
    isDeleting.value = false;
  }
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(() => {
  if (isEditMode.value) {
    loadDetail();
  }
});
</script>

<style scoped>
.facility-master-section {
  min-height: calc(100vh - 80px);
  padding: 36px 0 60px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* ── Back nav ────────────────────────────────────────────────────── */
.back-nav { margin-bottom: 16px; }

.back-link {
  color: #667eea;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover { text-decoration: underline; }

/* ── Card ────────────────────────────────────────────────────────── */
.master-card {
  background: white;
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

/* ── Card header ─────────────────────────────────────────────────── */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.card-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 4px;
}

.card-header p {
  font-size: 13px;
  color: #718096;
  margin: 0;
}

.header-id {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.id-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #a0aec0;
  font-weight: 600;
}

.id-value {
  font-size: 13px;
  font-weight: 700;
  color: #667eea;
  background: #ebf4ff;
  padding: 3px 10px;
  border-radius: 20px;
}

/* ── Alert ──────────────────────────────────────────────────────── */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert-danger  { background: #fed7d7; color: #742a2a; border: 1px solid #feb2b2; }
.alert-success { background: #c6f6d5; color: #22543d; border: 1px solid #9ae6b4; }
.alert-warning { background: #fefcbf; color: #744210; border: 1px solid #faf089; }

/* ── Loading ────────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
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

/* ── Form ────────────────────────────────────────────────────────── */
.master-form .form-group { margin-bottom: 20px; }

.master-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.required { color: #e53e3e; margin-left: 2px; }

.master-form input[type="text"],
.master-form input[type="number"],
.master-form textarea {
  width: 100%;
  padding: 11px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.master-form input:focus,
.master-form textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.master-form input:disabled,
.master-form textarea:disabled {
  background: #edf2f7;
  cursor: not-allowed;
  color: #718096;
}

.master-form textarea { resize: vertical; min-height: 80px; }

.field-hint {
  margin: 5px 0 0;
  font-size: 12px;
  color: #a0aec0;
}

/* ── Icon input ─────────────────────────────────────────────────── */
.icon-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  font-size: 22px;
  background: #f7fafc;
  flex-shrink: 0;
}

.icon-placeholder { color: #cbd5e0; font-size: 18px; }

.icon-input-wrapper input { flex: 1; }

.quick-emoji {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.emoji-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
  background: white;
}

.emoji-chip:hover { border-color: #667eea; background: #ebf4ff; transform: scale(1.1); }

.emoji-selected {
  border-color: #667eea;
  background: #ebf4ff;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

/* ── Audit info ─────────────────────────────────────────────────── */
.audit-info { margin-top: 8px; margin-bottom: 20px; }

.audit-divider {
  position: relative;
  text-align: center;
  margin: 24px 0 18px;
}

.audit-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e2e8f0;
}

.audit-divider span {
  position: relative;
  background: white;
  padding: 0 12px;
  font-size: 11px;
  font-weight: 600;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.audit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: #f7fafc;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.audit-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.audit-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #a0aec0;
  font-weight: 600;
}

.audit-value {
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
}

/* ── Status bar ─────────────────────────────────────────────────── */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7fafc;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  gap: 12px;
  flex-wrap: wrap;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.badge-aktif    { background: #c6f6d5; color: #22543d; }
.badge-disabled { background: #fed7d7; color: #742a2a; }

.btn-toggle-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  min-width: 130px;
  justify-content: center;
}

.btn-toggle-status:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-toggle-disable { background: #fed7d7; color: #742a2a; }
.btn-toggle-disable:hover:not(:disabled) { background: #feb2b2; }

.btn-toggle-enable  { background: #c6f6d5; color: #22543d; }
.btn-toggle-enable:hover:not(:disabled)  { background: #9ae6b4; }

.status-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-delete-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #feb2b2;
  background: white;
  color: #c53030;
  transition: all 0.15s;
  justify-content: center;
}

.btn-delete-status:hover:not(:disabled) { background: #fff5f5; border-color: #fc8181; }
.btn-delete-status:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Confirm Delete Modal ───────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-box {
  background: white;
  border-radius: 14px;
  padding: 28px 26px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.modal-icon { font-size: 40px; margin-bottom: 10px; }

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 8px;
}

.modal-desc {
  font-size: 14px;
  color: #718096;
  margin: 0 0 22px;
  line-height: 1.5;
}

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
.btn-confirm-danger { background: #e53e3e; }
.btn-confirm-danger:hover:not(:disabled) { background: #c53030; }

/* ── Form actions ───────────────────────────────────────────────── */
.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel {
  display: inline-flex;
  align-items: center;
  padding: 11px 24px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #4a5568;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover { background: #f7fafc; color: #2d3748; }

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 28px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:hover:not(:disabled) { opacity: 0.9; }
.btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 576px) {
  .master-card { padding: 24px 16px; }

  .audit-grid { grid-template-columns: 1fr; }

  .form-actions {
    flex-direction: column-reverse;
    gap: 10px;
  }

  .btn-cancel,
  .btn-submit { width: 100%; justify-content: center; }

  .card-header { flex-direction: column; }
  .header-id   { align-items: flex-start; }

  .quick-emoji { gap: 4px; }
  .emoji-chip  { width: 32px; height: 32px; font-size: 16px; }
}
</style>
