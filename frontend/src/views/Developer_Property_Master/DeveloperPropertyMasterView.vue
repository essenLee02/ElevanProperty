<template>
  <section class="master-form-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-7 col-lg-8 col-md-10">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/developer-property" class="back-link">
              ← Kembali ke Daftar Developer Property
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Developer Property' : 'Tambah Developer Property' }}</h2>
                <p>
                  {{ isEditMode
                    ? 'Perbarui informasi brand agensi properti'
                    : 'Tambahkan brand agensi properti baru ke master data' }}
                </p>
              </div>
              <div v-if="isEditMode && form.developer_property_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.developer_property_id }}</span>
              </div>
            </div>

            <!-- Alert -->
            <div v-if="alert.message" :class="['alert', `alert-${alert.type}`]" role="alert">
              {{ alert.message }}
            </div>

            <!-- Loading (edit mode — ambil data dulu) -->
            <div v-if="isLoadingDetail" class="loading-state">
              <div class="spinner-lg"></div>
              <p>Memuat data developer property...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- Nama Developer Property -->
              <div class="form-group">
                <label class="col-form-label" for="name">
                  Nama Developer Property <span class="required">*</span>
                </label>
                <input class="form-control form-control-lg form-control-sm"
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Contoh: Ray White, Brighton, Xavier Marks"
                  :disabled="isSubmitting"
                  maxlength="100"
                  required
                  autocomplete="off"
                />
                <p class="field-hint">
                  Nama brand agensi/brokerage tempat agent bernaung. Maksimal 100 karakter.
                </p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.developer_property_id" class="audit-info">
                <div class="audit-divider">
                  <span>Informasi Audit</span>
                </div>

                <!-- Jumlah agent pemakai — penting agar admin tahu DAMPAK
                     sebelum menonaktifkan/menghapus brand ini. -->
                <div v-if="form.agent_count > 0" class="alert alert-info" role="status">
                  Brand ini dipakai oleh <strong>{{ form.agent_count }}</strong> agent.
                  Pindahkan mereka ke developer property lain sebelum menghapus.
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
                <router-link to="/developer-property" class="btn-cancel">
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
                  <span v-else>
                    {{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Developer Property' }}
                  </span>
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
      title="Hapus Developer Property?"
      :busy="isDeleting"
      @confirm="handleDelete"
      @cancel="closeDeleteModal"
    >
      Developer property <strong>"{{ form.name }}"</strong> akan dihapus.
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
  getDeveloperPropertyDetail,
  insertDeveloperProperty,
  updateDeveloperProperty,
  toggleDeveloperPropertyStatus,
  deleteDeveloperProperty
} from '../../services/developerPropertyApi';

const route  = useRoute();
const router = useRouter();

/* ── Mode detection ─────────────────────────────────────────────── */
const developerPropertyId = computed(() => route.params.developer_property_id || null);
const isEditMode          = computed(() => !!developerPropertyId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail  = ref(false);
const isSubmitting     = ref(false);
const isTogglingStatus = ref(false);
const isDeleting       = ref(false);

const deleteModal = reactive({ show: false });

const form = reactive({
  developer_property_id: '',
  name:            '',
  status:          1,
  agent_count:     0,
  created_date:    '',
  created_by:      '',
  created_by_name: '',
  updated_date:    '',
  updated_by:      '',
  updated_by_name: ''
});

const originalForm = reactive({ name: '' });

const alert = reactive({ type: '', message: '' });

/* ── Computed ───────────────────────────────────────────────────── */
const hasChanges = computed(() => {
  if (!isEditMode.value) return !!form.name.trim();
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

const syncOriginal = () => { originalForm.name = form.name; };

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getDeveloperPropertyDetail(developerPropertyId.value);
    if (result?.isSuccess === 1) {
      const d = result.data.response.developerProperty;
      Object.assign(form, {
        developer_property_id: d.developer_property_id || '',
        name:            d.name            || '',
        status:          d.status          ?? 1,
        agent_count:     d.agent_count     ?? 0,
        created_date:    d.created_date    || '',
        created_by:      d.created_by      || '',
        created_by_name: d.created_by_name || '',
        updated_date:    d.updated_date    || '',
        updated_by:      d.updated_by      || '',
        updated_by_name: d.updated_by_name || ''
      });
      syncOriginal();
    } else {
      setAlert('danger', result?.data?.message || 'Developer property tidak ditemukan');
      setTimeout(() => router.push('/developer-property'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return; // interceptor sudah redirect ke /login
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data developer property';
    setAlert('danger', msg);
    setTimeout(() => router.push('/developer-property'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.name.trim()) {
    setAlert('warning', 'Nama developer property wajib diisi');
    return;
  }
  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  isSubmitting.value = true;
  const payload = { name: form.name };

  try {
    const result = isEditMode.value
      ? await updateDeveloperProperty(developerPropertyId.value, payload)
      : await insertDeveloperProperty(payload);

    if (result?.isSuccess === 1) {
      const msg = result.data.message
        || (isEditMode.value ? 'Developer property berhasil diperbarui' : 'Developer property berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const d = result.data.response.developerProperty;
        Object.assign(form, {
          updated_date:    d.updated_date    || '',
          updated_by:      d.updated_by      || '',
          updated_by_name: d.updated_by_name || ''
        });
        syncOriginal();
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/developer-property');
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
    const result = await toggleDeveloperPropertyStatus(developerPropertyId.value);
    if (result?.isSuccess === 1) {
      const d = result.data.response.developerProperty;
      Object.assign(form, {
        status:          d.status,
        updated_date:    d.updated_date    || '',
        updated_by:      d.updated_by      || '',
        updated_by_name: d.updated_by_name || ''
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
    const result = await deleteDeveloperProperty(developerPropertyId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Developer property berhasil dihapus');
      deleteModal.show = false;
      router.push('/developer-property');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus developer property');
    }
  } catch (err) {
    if (err?.response?.status === 401) return; // interceptor handle redirect
    // 409 = masih dipakai agent → pesan controller sudah menjelaskan langkahnya.
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus developer property');
    deleteModal.show = false;
  } finally {
    isDeleting.value = false;
  }
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(() => {
  if (isEditMode.value) loadDetail();
});
</script>
