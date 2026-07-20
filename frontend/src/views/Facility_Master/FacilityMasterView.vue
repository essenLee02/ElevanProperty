<template>
  <section class="master-form-section">
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
    <ConfirmModal
      :show="deleteModal.show"
      title="Hapus Fasilitas?"
      :busy="isDeleting"
      @confirm="handleDelete"
      @cancel="closeDeleteModal"
    >
      Fasilitas <strong>"{{ form.name }}"</strong> akan dihapus.
      Tindakan ini tidak dapat dibatalkan.
    </ConfirmModal>
  </section>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import ConfirmModal from '../../components/ConfirmModal.vue';
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
  // Comfort & Amenities
  '🛁', '🚿', '🛏️', '🛋️', '❄️', '🔥', '💡',
  // Kitchen & Dining
  '🍽️', '🍳', '☕', '🍷', '🍾',
  // Recreation & Sports
  '🏊', '🏋️', '🧘', '🎱', '🎰', '🎪',
  // Outdoor & Views
  '🌿', '🌳', '🏞️', '🏔️', '🌊', '🌅',
  // Kids & Family
  '🎠', '🎨', '🧸', '🎮', '🎭',
  // Security & Tech
  '📷', '🔒', '📹', '🚨', '📱', '💻',
  // Parking & Access
  '🅿️', '🚗', '🛗', '🚪', '🔑',
  // Utilities
  '📶', '⚡', '💧', '🧺', '🧹',
  // Wellness & Relaxation
  '🧖', '💆', '🛀', '🕯️', '♨️', '🌡️', '📦'
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
      const facility = result.data.response.facility;
      Object.assign(form, {
        status:          facility.status,
        updated_date:    facility.updated_date    || '',
        updated_by:      facility.updated_by      || '',
        updated_by_name: facility.updated_by_name || ''
      });
      toast.success(result.data.message || 'Status berhasil diubah');
      setAlert('success', result.data.message);
      setTimeout(clearAlert, 3000);
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
