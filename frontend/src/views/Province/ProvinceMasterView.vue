<template>
  <section class="master-form-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-7 col-lg-8 col-md-10">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/province" class="back-link">
              ← Kembali ke Daftar Provinsi
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Provinsi' : 'Tambah Provinsi' }}</h2>
                <p>{{ isEditMode ? 'Perbarui informasi provinsi' : 'Tambahkan provinsi baru ke master data' }}</p>
              </div>
              <div v-if="isEditMode && form.province_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.province_id }}</span>
              </div>
            </div>

            <!-- Alert -->
            <div v-if="alert.message" :class="['alert', `alert-${alert.type}`]" role="alert">
              {{ alert.message }}
            </div>

            <!-- Loading (edit mode — ambil data dulu) -->
            <div v-if="isLoadingDetail" class="loading-state">
              <div class="spinner-lg"></div>
              <p>Memuat data provinsi...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- Negara (pilih via modal — terhubung database) -->
              <div class="form-group">
                <label for="country_name">Negara <span class="required">*</span></label>
                <div class="picker-field" :class="{ disabled: isSubmitting }">
                  <input
                    id="country_name"
                    v-model="form.country_name"
                    type="text"
                    placeholder="Ketik nama negara, lalu tekan Enter / Tab"
                    :disabled="isSubmitting"
                    autocomplete="off"
                    @keydown="onPickerKey($event, showModalCountry)"
                    @input="onCountryInput"
                  />
                  <button type="button" class="picker-btn" :disabled="isSubmitting" @click="showModalCountry()">
                    <i class="fa-solid fa-magnifying-glass"></i>
                  </button>
                </div>
                <p class="field-hint">Tekan Enter/Tab atau klik 🔍 untuk memilih negara induk. Ketik <b>*</b> lalu Enter untuk semua.</p>
              </div>

              <!-- Nama Provinsi -->
              <div class="form-group">
                <label for="name">Nama Provinsi <span class="required">*</span></label>
                <input
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Contoh: Jawa Timur, DKI Jakarta, Bali"
                  :disabled="isSubmitting"
                  maxlength="100"
                  required
                  autocomplete="off"
                />
                <p class="field-hint">Maksimal 100 karakter</p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.province_id" class="audit-info">
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
                <router-link to="/province" class="btn-cancel">Batal</router-link>
                <button type="submit" class="btn-submit" :disabled="isSubmitting || !hasChanges">
                  <span v-if="isSubmitting"><span class="spinner-sm"></span> Menyimpan...</span>
                  <span v-else>{{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Provinsi' }}</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>

    <!-- Pemilih data (negara) — terhubung database -->
    <Modal ref="modalRef" />

    <!-- Confirm Delete Modal -->
    <div v-if="deleteModal.show" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-box">
        <div class="modal-icon">🗑️</div>
        <h3 class="modal-title">Hapus Provinsi?</h3>
        <p class="modal-desc">
          Provinsi <strong>"{{ form.name }}"</strong> akan dihapus.
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
  getProvinceDetail,
  insertProvince,
  updateProvince,
  toggleProvinceStatus,
  deleteProvince
} from '../../services/provinceApi';
import { getCountryList } from '../../services/countryApi';
import Modal from '../../components/Modal.vue';

const route  = useRoute();
const router = useRouter();

/* ── Ref komponen pemilih data (modal terhubung database) ───────────── */
const modalRef = ref(null);

/* ── Mode detection ─────────────────────────────────────────────── */
const provinceId = computed(() => route.params.province_id || null);
const isEditMode = computed(() => !!provinceId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail  = ref(false);
const isSubmitting     = ref(false);
const isTogglingStatus = ref(false);
const isDeleting       = ref(false);

const deleteModal    = reactive({ show: false });

const form = reactive({
  province_id:     '',
  country_id:      '',
  country_name:    '',
  name:            '',
  status:          1,
  created_date:    '',
  created_by:      '',
  created_by_name: '',
  updated_date:    '',
  updated_by:      '',
  updated_by_name: ''
});

const originalForm = reactive({ country_id: '', name: '' });

const alert = reactive({ type: '', message: '' });

/* ── Computed ───────────────────────────────────────────────────── */
const hasChanges = computed(() => {
  if (!isEditMode.value) return !!form.name.trim() && !!form.country_id;
  return (
    String(form.country_id) !== String(originalForm.country_id) ||
    form.name !== originalForm.name
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
  originalForm.country_id = form.country_id;
  originalForm.name       = form.name;
};

/* ── Pemilih Negara via Modal (terhubung database) ──────────────── */

/** Buka modal jika user menekan Enter atau Tab pada input. */
const onPickerKey = (e, opener) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    opener(e.target.value);
  }
};

/** Saat user mengetik manual, batalkan pilihan id agar wajib pilih ulang. */
const onCountryInput = () => { form.country_id = ''; };

/** Fetcher untuk Modal: kembalikan { rows, currentPage, lastPage }. */
const fetchCountries = async (search, page) => {
  const result = await getCountryList({ search, page });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.countries || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};

const showModalCountry = (seed = '') => {
  modalRef.value?.open({
    title:        'Pilih Negara',
    placeholder:  'Ketik nama negara, atau * untuk semua',
    headers:      ['Negara', 'Status'],
    chunks:       ['name', 'status'],
    actionParams: ['country_id', 'name'],
    multiSelect:  false,
    initialSearch: seed || form.country_name,
    fetch:        fetchCountries,
    onChoose: (sel) => {
      form.country_id   = sel.country_id;
      form.country_name = sel.name;
    }
  });
};

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getProvinceDetail(provinceId.value);
    if (result?.isSuccess === 1) {
      const p = result.data.response.province;
      Object.assign(form, {
        province_id:     p.province_id     || '',
        country_id:      p.country_id      || '',
        country_name:    p.country_name    || '',
        name:            p.name            || '',
        status:          p.status          ?? 1,
        created_date:    p.created_date    || '',
        created_by:      p.created_by      || '',
        created_by_name: p.created_by_name || '',
        updated_date:    p.updated_date    || '',
        updated_by:      p.updated_by      || '',
        updated_by_name: p.updated_by_name || ''
      });
      syncOriginal();
    } else {
      setAlert('danger', result?.data?.message || 'Provinsi tidak ditemukan');
      setTimeout(() => router.push('/province'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data provinsi';
    setAlert('danger', msg);
    setTimeout(() => router.push('/province'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.country_id) {
    setAlert('warning', 'Negara wajib dipilih');
    return;
  }
  if (!form.name.trim()) {
    setAlert('warning', 'Nama provinsi wajib diisi');
    return;
  }
  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  isSubmitting.value = true;
  const payload = { country_id: form.country_id, name: form.name };

  try {
    let result;
    if (isEditMode.value) {
      result = await updateProvince(provinceId.value, payload);
    } else {
      result = await insertProvince(payload);
    }

    if (result?.isSuccess === 1) {
      const msg = result.data.message || (isEditMode.value ? 'Provinsi berhasil diperbarui' : 'Provinsi berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const p = result.data.response.province;
        Object.assign(form, {
          updated_date:    p.updated_date    || '',
          updated_by:      p.updated_by      || '',
          updated_by_name: p.updated_by_name || ''
        });
        syncOriginal();
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/province');
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
    const result = await toggleProvinceStatus(provinceId.value);
    if (result?.isSuccess === 1) {
      const province = result.data.response.province;
      Object.assign(form, {
        status:          province.status,
        updated_date:    province.updated_date    || '',
        updated_by:      province.updated_by      || '',
        updated_by_name: province.updated_by_name || ''
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
    const result = await deleteProvince(provinceId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Provinsi berhasil dihapus');
      deleteModal.show = false;
      router.push('/province');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus provinsi');
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus provinsi');
  } finally {
    isDeleting.value = false;
  }
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(() => {
  if (isEditMode.value) loadDetail();
});
</script>
