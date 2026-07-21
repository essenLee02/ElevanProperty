<template>
  <section class="master-form-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-7 col-lg-8 col-md-10">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/customer" class="back-link">
              ← Kembali ke Daftar Customer
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Customer' : 'Tambah Customer' }}</h2>
                <p>{{ isEditMode ? 'Perbarui informasi customer' : 'Daftarkan customer baru secara manual' }}</p>
              </div>
              <div v-if="isEditMode && form.customer_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.customer_id }}</span>
              </div>
            </div>

            <!-- Alert -->
            <div v-if="alert.message" :class="['alert', `alert-${alert.type}`]" role="alert">
              {{ alert.message }}
            </div>

            <!-- Loading (edit mode — ambil data dulu) -->
            <div v-if="isLoadingDetail" class="loading-state">
              <div class="spinner-lg"></div>
              <p>Memuat data customer...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- Nama Customer -->
              <div class="form-group">
                <label class="col-form-label" for="name">Nama Customer <span class="required">*</span></label>
                <input
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Contoh: Rina, Budi Santoso"
                  :disabled="isSubmitting"
                  maxlength="100"
                  required
                  autocomplete="off"
                  class="form-control form-control-lg form-control-sm"
                />
                <p class="field-hint">Maksimal 100 karakter</p>
              </div>

              <!-- No. WhatsApp -->
              <div class="form-group">
                <label class="col-form-label" for="phone">No. WhatsApp</label>
                <input
                  id="phone"
                  :value="form.phone"
                  @input="onPhoneInput"
                  type="tel"
                  :placeholder="fnReady ? 'Contoh: 0812xxxxxx atau 62812xxxxxx' : 'Menyiapkan form...'"
                  :disabled="isSubmitting || !fnReady"
                  maxlength="30"
                  autocomplete="off"
                  class="form-control form-control-lg form-control-sm"
                />
                <p class="field-hint">
                  Nomor akan dinormalisasi ke format 62. Satu nomor hanya boleh terdaftar sekali per agent —
                  customer yang chat via WhatsApp dikenali lewat nomor ini.
                </p>
              </div>

              <!-- Email -->
              <div class="form-group">
                <label class="col-form-label" for="email">Email</label>
                <input
                  id="email"
                  v-model.trim="form.email"
                  type="email"
                  placeholder="Contoh: rina@gmail.com"
                  :disabled="isSubmitting"
                  maxlength="200"
                  autocomplete="off"
                  class="form-control form-control-lg form-control-sm"
                />
                <p class="field-hint">Opsional — dipakai untuk undangan jadwal viewing (Google Calendar)</p>
              </div>

              <!-- AI Response -->
              <div class="form-group">
                <label class="col-form-label" for="ai_response">AI Response</label>
                <div class="select-wrapper">
                  <select id="ai_response" v-model="form.ai_response" class="form-control form-control-lg form-control-sm" :disabled="isSubmitting">
                    <option value="ON">ON — AI membalas chat customer ini</option>
                    <option value="OFF">OFF — AI diam (agent takeover manual)</option>
                  </select>
                </div>
                <p class="field-hint label">Matikan bila agent ingin menangani chat customer ini secara manual</p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.customer_id" class="audit-info">
                <div class="audit-divider">
                  <span>Informasi Audit</span>
                </div>

                <div class="audit-grid">
                  <div class="audit-item">
                    <span class="audit-label">Agent pemilik</span>
                    <span class="audit-value">{{ form.agent_name || form.user_id || '—' }}</span>
                  </div>
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
                <router-link to="/customer" class="btn-cancel">Batal</router-link>
                <button type="submit" class="btn-submit" :disabled="isSubmitting || !hasChanges || !fnReady">
                  <span v-if="isSubmitting"><span class="spinner-sm"></span> Menyimpan...</span>
                  <span v-else>{{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Customer' }}</span>
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
      title="Hapus Customer?"
      :busy="isDeleting"
      @confirm="handleDelete"
      @cancel="closeDeleteModal"
    >
      Customer <strong>"{{ form.name }}"</strong> akan dihapus.
      Tindakan ini tidak dapat dibatalkan.
    </ConfirmModal>
  </section>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import {
  getCustomerDetail,
  insertCustomer,
  updateCustomer,
  toggleCustomerStatus,
  deleteCustomer
} from '../../services/customerApi';
import ConfirmModal from '../../components/ConfirmModal.vue';

const route  = useRoute();
const router = useRouter();

/* ── Mode detection ─────────────────────────────────────────────── */
const customerId = computed(() => route.params.customer_id || null);
const isEditMode = computed(() => !!customerId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail  = ref(false);
const isSubmitting     = ref(false);
const isTogglingStatus = ref(false);
const isDeleting       = ref(false);
const fnReady          = ref(false);   // true setelah Function_Path (window.formatPhone/formatEmail) siap

const deleteModal = reactive({ show: false });

const form = reactive({
  customer_id:     '',
  user_id:         '',
  agent_name:      '',
  name:            '',
  phone:           '',
  email:           '',
  ai_response:     'ON',
  status:          1,
  created_date:    '',
  created_by:      '',
  created_by_name: '',
  updated_date:    '',
  updated_by:      '',
  updated_by_name: ''
});

const originalForm = reactive({ name: '', phone: '', email: '', ai_response: 'ON' });

const alert = reactive({ type: '', message: '' });

/* ── Computed ───────────────────────────────────────────────────── */
const hasChanges = computed(() => {
  if (!isEditMode.value) return !!form.name.trim();
  return (
    form.name        !== originalForm.name  ||
    (form.phone  || '') !== (originalForm.phone  || '') ||
    (form.email  || '') !== (originalForm.email  || '') ||
    form.ai_response !== originalForm.ai_response
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
  originalForm.phone       = form.phone;
  originalForm.email       = form.email;
  originalForm.ai_response = form.ai_response;
};

/* ── No. WhatsApp — auto-format pakai window.formatPhone() (Function_Path) ──
   Guard kesiapan TIDAK dicek di sini — input phone di template sudah
   :disabled="!fnReady", jadi event @input ini secara struktural mustahil
   terpicu sebelum window.formatPhone ada (browser tidak mengirim event pada
   elemen disabled). Satu guard di level UI, bukan typeof-check berulang di
   tiap fungsi. formatPhone() membersihkan karakter non-digit lalu menyisipkan
   strip tiap 4 digit ("081234567890" → "0812-3456-7890"). Backend
   menormalisasi ulang ke digit murni (format 62xxx) saat disimpan. */
const onPhoneInput = (e) => {
  const formatted = window.formatPhone(e.target.value);
  form.phone = formatted;
  e.target.value = formatted;
};

/* ── Guard TUNGGAL: tunggu Function_Path (window.formatPhone/formatEmail) siap ──
   Sama seperti waitForFunctions() di List views (CityListView, CustomerListView,
   dll) untuk window.tableModal — App.vue menyuntikkan script secara ASYNC
   (document.createElement('script') tanpa async=false), jadi TIDAK ada jaminan
   ia sudah tersedia saat komponen form ini mount. Guard ini SATU-SATUNYA titik
   pemeriksaan; setelah fnReady=true, seluruh pemanggilan window.formatXXX di
   bawah tidak perlu diguard ulang. */
const waitForFunctions = () => new Promise((resolve) => {
  const ready = () => typeof window.formatPhone === 'function' && typeof window.formatEmail === 'function';
  if (ready()) return resolve();
  const timer = setInterval(() => { if (ready()) { clearInterval(timer); resolve(); } }, 50);
});

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getCustomerDetail(customerId.value);
    if (result?.isSuccess === 1) {
      const c = result.data.response.customer;
      Object.assign(form, {
        customer_id:     c.customer_id     || '',
        user_id:         c.user_id         || '',
        agent_name:      c.agent_name      || '',
        name:            c.name            || '',
        phone:           c.phone ? window.formatPhone(c.phone) : '',
        email:           c.email           || '',
        ai_response:     c.ai_response     || 'ON',
        status:          c.status          ?? 1,
        created_date:    c.created_date    || '',
        created_by:      c.created_by      || '',
        created_by_name: c.created_by_name || '',
        updated_date:    c.updated_date    || '',
        updated_by:      c.updated_by      || '',
        updated_by_name: c.updated_by_name || ''
      });
      syncOriginal();
    } else {
      setAlert('danger', result?.data?.message || 'Customer tidak ditemukan');
      setTimeout(() => router.push('/customer'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data customer';
    setAlert('danger', msg);
    setTimeout(() => router.push('/customer'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.name.trim()) {
    setAlert('warning', 'Nama customer wajib diisi');
    return;
  }
  // Guard TUNGGAL: kalau Function_Path (script global App.vue) belum sempat
  // termuat (race condition — lihat waitForFunctions), tolak submit di sini
  // saja daripada menyebar typeof-check di tiap pemanggilan window.formatXXX.
  if (!fnReady.value) {
    setAlert('warning', 'Form belum siap sepenuhnya, coba lagi sebentar lagi.');
    return;
  }
  // formatEmail() (Function_Path, dimuat global oleh App.vue) — validator
  // boolean, bukan formatter string. Dipanggil langsung tanpa guard lagi —
  // fnReady di atas sudah menjamin window.formatEmail ada.
  if (form.email && !window.formatEmail(form.email)) {
    setAlert('warning', 'Format email tidak valid');
    return;
  }
  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  isSubmitting.value = true;
  const payload = {
    name:        form.name,
    phone:       form.phone || null,
    email:       form.email || null,
    ai_response: form.ai_response
  };

  try {
    let result;
    if (isEditMode.value) {
      result = await updateCustomer(customerId.value, payload);
    } else {
      result = await insertCustomer(payload);
    }

    if (result?.isSuccess === 1) {
      const msg = result.data.message || (isEditMode.value ? 'Customer berhasil diperbarui' : 'Customer berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const c = result.data.response.customer;
        Object.assign(form, {
          updated_date:    c.updated_date    || '',
          updated_by:      c.updated_by      || '',
          updated_by_name: c.updated_by_name || ''
        });
        syncOriginal();
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/customer');
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
    const result = await toggleCustomerStatus(customerId.value);
    if (result?.isSuccess === 1) {
      const c = result.data.response.customer;
      Object.assign(form, {
        status:       c.status,
        updated_date: c.updated_date || '',
        updated_by:   c.updated_by   || ''
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
    const result = await deleteCustomer(customerId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Customer berhasil dihapus');
      deleteModal.show = false;
      router.push('/customer');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus customer');
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus customer');
  } finally {
    isDeleting.value = false;
  }
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(async () => {
  await waitForFunctions();
  fnReady.value = true;
  if (isEditMode.value) loadDetail();
});
</script>
