<template>
  <section class="profile-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-6 col-lg-7 col-md-9">
          <div class="profile-card">
            <div class="profile-header">
              <h2>Profil Saya</h2>
              <p>Kelola informasi akun Anda</p>
            </div>

            <!-- Alert pesan -->
            <div
              v-if="alert.message"
              :class="['alert', alertClass]"
              role="alert"
            >
              {{ alert.message }}
            </div>

            <!-- Loading state -->
            <div v-if="isLoading" class="loading-spinner">
              <p>Memuat data profil...</p>
            </div>

            <!-- Profile Form -->
            <form v-else @submit.prevent="submitUpdate" class="profile-form">

              <!-- User ID (read-only) -->
              <div class="form-group">
                <label class="col-form-label" for="userId">User ID</label>
                <input
                  id="userId"
                  :value="form.user_id"
                  type="text"
                  disabled
                  class="form-control-static form-control form-control-lg form-control-sm"
                />
              </div>

              <!-- Nama Lengkap (wajib) -->
              <div class="form-group">
                <label class="col-form-label" for="name">Nama Lengkap <span class="required">*</span></label>
                <input class="form-control form-control-lg form-control-sm"
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Nama lengkap"
                  :disabled="isSubmitting"
                  required
                />
              </div>

              <!-- Nomor HP (wajib) -->
              <div class="form-group">
                <label class="col-form-label" for="phone">Nomor HP <span class="required">*</span></label>
                <input class="form-control form-control-lg form-control-sm"
                  id="phone"
                  v-model.trim="form.phone"
                  type="tel"
                  placeholder="08123456789"
                  :disabled="isSubmitting"
                  @input="sanitizePhone"
                  required
                />
              </div>

              <!-- Tanggal Lahir (opsional) -->
              <div class="form-group">
                <label class="col-form-label" for="birthdate">Tanggal Lahir</label>
                <input
                  id="birthdate"
                  v-model="form.birthdate"
                  type="date"
                  :disabled="isSubmitting"
                />
              </div>

              <!-- Email (opsional) -->
              <div class="form-group">
                <label class="col-form-label" for="email">Email</label>
                <input class="form-control form-control-lg form-control-sm"
                  id="email"
                  v-model.trim="form.email"
                  type="email"
                  placeholder="nama@email.com"
                  :disabled="isSubmitting"
                />
              </div>

              <!-- Catalog Summary Status (ON/OFF) -->
              <div class="form-group">
                <label class="col-form-label" for="catalogSummary">Catalog Summary Status</label>
                <select
                  id="catalogSummary"
                  v-model="form.catalog_summary"
                  :disabled="isSubmitting"
                >
                  <option value="ON">ON — Summary dengan catalog</option>
                  <option value="OFF">OFF — Summary tanpa catalog</option>
                </select>
                <p class="field-hint">Menentukan apakah ringkasan chatbot menyertakan daftar katalog properti.</p>
              </div>

              <!-- Divider -->
              <div class="section-divider">
                <span>Keamanan & Integrasi</span>
              </div>

              
              <!-- Username (disabled — tidak bisa diubah) -->
              <div class="form-group">
                <label class="col-form-label" for="username">
                  Username
                  <span class="badge-locked">🔒 Tidak dapat diubah</span>
                </label>
                <input
                  id="username"
                  :value="form.username"
                  type="text"
                  disabled
                  class="form-control-static form-control form-control-lg form-control-sm"
                />
              </div>
              
              <!-- Password Baru (wajib) -->
              <div class="form-group">
                <label class="col-form-label" for="password">
                  Password <span class="required">*</span>
                </label>
                <div class="input-password-wrapper">
                  <input class="form-control form-control-lg form-control-sm"
                    id="password"
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Masukkan password Anda"
                    :disabled="isSubmitting"
                    autocomplete="off"
                    required
                  />
                  <button
                    type="button"
                    class="btn-toggle-password"
                    @click="showPassword = !showPassword"
                    :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
                  >
                    {{ showPassword ? '🙈' : '👁️' }}
                  </button>
                </div>
                <p class="field-hint">Minimal 6 karakter. Wajib diisi setiap menyimpan profil.</p>
              </div>

              <!-- Fonnte API (opsional) -->
              <div class="form-group">
                <label class="col-form-label" for="fonnteApi">Fonnte API</label>
                <input class="form-control form-control-lg form-control-sm"
                  id="fonnteApi"
                  v-model.trim="form.fonnte_token"
                  type="text"
                  placeholder="Masukkan Fonnte API token (opsional)"
                  :disabled="isSubmitting"
                />
                <p class="field-hint">Token API Fonnte pribadi Anda. Boleh dikosongkan.</p>
              </div>

              <!-- Kirimi Device ID (opsional) -->
              <div class="form-group">
                <label class="col-form-label" for="kirimiDeviceId">Kirimi Device ID</label>
                <input class="form-control form-control-lg form-control-sm"
                  id="kirimiDeviceId"
                  v-model.trim="form.kirimi_device_id"
                  type="text"
                  placeholder="Masukkan Device ID Kirimi (mis. D-3OCA6, opsional)"
                  :disabled="isSubmitting"
                />
                <p class="field-hint">Device ID dari dashboard Kirimi (mis. D-3OCA6). Boleh dikosongkan.</p>
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmitting || !hasChanges"
              >
                <span v-if="isSubmitting">
                  <span class="spinner"></span> Menyimpan...
                </span>
                <span v-else>Simpan Perubahan</span>
              </button>

              <div class="profile-footer">
                <router-link to="/" class="back-link">← Kembali ke beranda</router-link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { getCurrentProfile, updateProfile } from '../services/profileApi';

const router = useRouter();

/* ── State ────────────────────────────────────── */
const form = reactive({
  user_id:        '',
  name:           '',
  username:       '',
  phone:          '',
  birthdate:      '',
  email:          '',
  catalog_summary: 'OFF',
  password:       '',
  fonnte_token:   '',
  kirimi_device_id: ''
});

// Nilai awal (untuk deteksi perubahan — kecuali password)
const originalForm = reactive({
  name:            '',
  phone:           '',
  birthdate:       '',
  email:           '',
  catalog_summary: 'OFF',
  fonnte_token:    '',
  kirimi_device_id: ''
});

const alert       = reactive({ type: '', message: '' });
const isLoading   = ref(true);
const isSubmitting = ref(false);
const showPassword = ref(false);

const PHONE_REGEX = /[^0-9+\-\s]/g;

/* ── Computed ────────────────────────────────── */
const alertClass = computed(() => {
  if (alert.type === 'success') return 'alert-success';
  if (alert.type === 'warning') return 'alert-warning';
  return 'alert-danger';
});

// Form dianggap "ada perubahan" jika:
// - Salah satu field (name/phone/birthdate/email/catalog_summary/fonnte_token/...) berbeda dari original, ATAU
// - Password sudah diisi
const hasChanges = computed(() => {
  return (
    form.name            !== originalForm.name            ||
    form.phone           !== originalForm.phone           ||
    form.birthdate       !== originalForm.birthdate       ||
    form.email           !== originalForm.email           ||
    form.catalog_summary !== originalForm.catalog_summary ||
    form.fonnte_token     !== originalForm.fonnte_token     ||
    form.kirimi_device_id !== originalForm.kirimi_device_id ||
    form.password.length > 0
  );
});

/* ── Helpers ─────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

const sanitizePhone = (event) => {
  form.phone = String(event?.target?.value || form.phone).replace(PHONE_REGEX, '');
};

/* ── Load profile ────────────────────────────── */
const loadProfile = async () => {
  isLoading.value = true;
  clearAlert();
  try {
    const result = await getCurrentProfile();

    if (result?.isSuccess === 1 && result?.data?.response?.user) {
      const user = result.data.response.user;

      form.user_id    = user.user_id    || '';
      form.name       = user.name       || '';
      form.username   = user.username   || '';
      form.phone      = user.phone      || '';
      form.birthdate  = user.birthdate ? user.birthdate.split('T')[0] : '';
      form.email            = user.email            || '';
      form.catalog_summary  = user.catalog_summary  || 'OFF';
      form.fonnte_token     = user.fonnte_token     || '';
      form.kirimi_device_id = user.kirimi_device_id || '';
      form.password         = '';

      // Simpan original (tidak termasuk password)
      originalForm.name             = form.name;
      originalForm.phone            = form.phone;
      originalForm.birthdate        = form.birthdate;
      originalForm.email            = form.email;
      originalForm.catalog_summary  = form.catalog_summary;
      originalForm.fonnte_token     = form.fonnte_token;
      originalForm.kirimi_device_id = form.kirimi_device_id;
    } else {
      setAlert('danger', result?.data?.message || 'Gagal memuat profil');
      setTimeout(() => router.push('/login'), 2000);
    }
  } catch (error) {
    const msg =
      error?.response?.data?.data?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Gagal memuat profil';
    setAlert('danger', msg);
    setTimeout(() => router.push('/login'), 2000);
  } finally {
    isLoading.value = false;
  }
};

/* ── Validasi ────────────────────────────────── */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateForm = () => {
  if (!form.name.trim())     return 'Nama wajib diisi';
  if (!form.phone.trim())    return 'Nomor HP wajib diisi';
  if (!form.password.trim()) return 'Password wajib diisi';
  if (form.password.trim().length < 6) return 'Password minimal 6 karakter';
  if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) return 'Format email tidak valid';
  return '';
};

/* ── Submit ──────────────────────────────────── */
const submitUpdate = async () => {
  clearAlert();

  if (!hasChanges.value) {
    setAlert('warning', 'Tidak ada perubahan data');
    return;
  }

  const errorMsg = validateForm();
  if (errorMsg) {
    setAlert('warning', errorMsg);
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      name:       form.name,
      phone:      form.phone,
      birthdate:  form.birthdate  || null,
      password:   form.password,
      email:            form.email            || null,
      catalog_summary:  form.catalog_summary   || null,
      fonnte_token:     form.fonnte_token     || null,
      kirimi_device_id: form.kirimi_device_id || null
      // username TIDAK dikirim — backend mengabaikannya
    };

    const result = await updateProfile(payload);

    if (result?.isSuccess === 1 && result?.data?.response?.user) {
      setAlert('success', result?.data?.message || 'Profil berhasil diupdate');
      toast.success(result?.data?.message || 'Profil berhasil diupdate');

      // Reset original values & kosongkan password
      originalForm.name            = form.name;
      originalForm.phone           = form.phone;
      originalForm.birthdate       = form.birthdate;
      originalForm.email           = form.email;
      originalForm.catalog_summary = form.catalog_summary;
      originalForm.fonnte_token     = form.fonnte_token;
      originalForm.kirimi_device_id = form.kirimi_device_id;
      form.password                 = '';

      setTimeout(() => clearAlert(), 3000);
    } else {
      setAlert('danger', result?.data?.message || 'Gagal update profil');
    }
  } catch (error) {
    const msg =
      error?.response?.data?.data?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Gagal update profil';
    setAlert('danger', msg);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  loadProfile();
});
</script>
