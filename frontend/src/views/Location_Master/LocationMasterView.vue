<template>
  <section class="master-form-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-7 col-lg-8 col-md-10">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/location" class="back-link">
              ← Kembali ke Daftar Lokasi
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Lokasi' : 'Tambah Lokasi' }}</h2>
                <p>{{ isEditMode ? 'Perbarui informasi lokasi rujukan' : 'Tambahkan lokasi rujukan baru ke master data' }}</p>
              </div>
              <div v-if="isEditMode && form.location_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.location_id }}</span>
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
              <p>Memuat data lokasi...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- Nama Lokasi -->
              <div class="form-group">
                <label for="name">Nama Lokasi <span class="required">*</span></label>
                <input
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Contoh: Pasar, PTC, Cafe, Kebun Binatang, Indomaret"
                  :disabled="isSubmitting"
                  maxlength="100"
                  required
                  autocomplete="off"
                />
                <p class="field-hint">Maksimal 100 karakter. Lokasi rujukan untuk pencarian properti.</p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.location_id" class="audit-info">
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
                <router-link to="/location" class="btn-cancel">
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
                  <span v-else>{{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Lokasi' }}</span>
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
      title="Hapus Lokasi?"
      :busy="isDeleting"
      @confirm="handleDelete"
      @cancel="closeDeleteModal"
    >
      Lokasi <strong>"{{ form.name }}"</strong> akan dihapus.
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
  getLocationDetail,
  insertLocation,
  updateLocation,
  toggleLocationStatus,
  deleteLocation
} from '../../services/locationApi';

const route  = useRoute();
const router = useRouter();

/* ── Mode detection ─────────────────────────────────────────────── */
const locationId  = computed(() => route.params.location_id || null);
const isEditMode  = computed(() => !!locationId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail  = ref(false);
const isSubmitting     = ref(false);
const isTogglingStatus = ref(false);
const isDeleting       = ref(false);

const deleteModal = reactive({ show: false });

const form = reactive({
  location_id:     '',
  name:            '',
  status:          1,
  created_date:    '',
  created_by:      '',
  created_by_name: '',
  updated_date:    '',
  updated_by:      '',
  updated_by_name: ''
});

const originalForm = reactive({
  name: ''
});

const alert = reactive({ type: '', message: '' });

/* ── Computed ───────────────────────────────────────────────────── */
const hasChanges = computed(() => {
  if (!isEditMode.value) {
    return !!form.name.trim();
  }
  return form.name !== originalForm.name;
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
  originalForm.name = form.name;
};

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getLocationDetail(locationId.value);
    if (result?.isSuccess === 1) {
      const loc = result.data.response.location;
      Object.assign(form, {
        location_id:     loc.location_id     || '',
        name:            loc.name            || '',
        status:          loc.status          ?? 1,
        created_date:    loc.created_date    || '',
        created_by:      loc.created_by      || '',
        created_by_name: loc.created_by_name || '',
        updated_date:    loc.updated_date    || '',
        updated_by:      loc.updated_by      || '',
        updated_by_name: loc.updated_by_name || ''
      });
      syncOriginal();
    } else {
      setAlert('danger', result?.data?.message || 'Lokasi tidak ditemukan');
      setTimeout(() => router.push('/location'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data lokasi';
    setAlert('danger', msg);
    setTimeout(() => router.push('/location'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.name.trim()) {
    setAlert('warning', 'Nama lokasi wajib diisi');
    return;
  }

  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  isSubmitting.value = true;

  const payload = {
    name: form.name
  };

  try {
    let result;
    if (isEditMode.value) {
      result = await updateLocation(locationId.value, payload);
    } else {
      result = await insertLocation(payload);
    }

    if (result?.isSuccess === 1) {
      const msg = result.data.message || (isEditMode.value ? 'Lokasi berhasil diperbarui' : 'Lokasi berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const loc = result.data.response.location;
        Object.assign(form, {
          updated_date:    loc.updated_date    || '',
          updated_by:      loc.updated_by      || '',
          updated_by_name: loc.updated_by_name || ''
        });
        syncOriginal();
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/location');
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

/* ── Toggle status ──────────────────────────────────────────────── */
const handleToggleStatus = async () => {
  isTogglingStatus.value = true;
  try {
    const result = await toggleLocationStatus(locationId.value);
    if (result?.isSuccess === 1) {
      const loc = result.data.response.location;
      Object.assign(form, {
        status:          loc.status,
        updated_date:    loc.updated_date    || '',
        updated_by:      loc.updated_by      || '',
        updated_by_name: loc.updated_by_name || ''
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

/* ── Soft delete ────────────────────────────────────────────────── */
const openDeleteModal  = () => { deleteModal.show = true; };
const closeDeleteModal = () => { if (!isDeleting.value) deleteModal.show = false; };

const handleDelete = async () => {
  isDeleting.value = true;
  try {
    const result = await deleteLocation(locationId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Lokasi berhasil dihapus');
      deleteModal.show = false;
      router.push('/location');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus lokasi');
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus lokasi');
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
