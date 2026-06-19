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
                <label for="userId">User ID</label>
                <input
                  id="userId"
                  :value="form.user_id"
                  type="text"
                  disabled
                  class="form-control-static"
                />
              </div>

              <!-- Nama Lengkap (wajib) -->
              <div class="form-group">
                <label for="name">Nama Lengkap <span class="required">*</span></label>
                <input
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
                <label for="phone">Nomor HP <span class="required">*</span></label>
                <input
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
                <label for="birthdate">Tanggal Lahir</label>
                <input
                  id="birthdate"
                  v-model="form.birthdate"
                  type="date"
                  :disabled="isSubmitting"
                />
              </div>

              <!-- Divider -->
              <div class="section-divider">
                <span>Keamanan & Integrasi</span>
              </div>

              
              <!-- Username (disabled — tidak bisa diubah) -->
              <div class="form-group">
                <label for="username">
                  Username
                  <span class="badge-locked">🔒 Tidak dapat diubah</span>
                </label>
                <input
                  id="username"
                  :value="form.username"
                  type="text"
                  disabled
                  class="form-control-static"
                />
              </div>
              
              <!-- Password Baru (wajib) -->
              <div class="form-group">
                <label for="password">
                  Password <span class="required">*</span>
                </label>
                <div class="input-password-wrapper">
                  <input
                    id="password"
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Masukkan password Anda"
                    :disabled="isSubmitting"
                    autocomplete="new-password"
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
                <label for="fonnteApi">Fonnte API</label>
                <input
                  id="fonnteApi"
                  v-model.trim="form.fonnte_token"
                  type="text"
                  placeholder="Masukkan Fonnte API token (opsional)"
                  :disabled="isSubmitting"
                />
                <p class="field-hint">Token API Fonnte pribadi Anda. Boleh dikosongkan.</p>
              </div>

              <!-- ChakraHQ Token (opsional) -->
              <div class="form-group">
                <label for="chakraHqToken">ChakraHQ Token</label>
                <input
                  id="chakraHqToken"
                  v-model.trim="form.chakra_hq_token"
                  type="text"
                  placeholder="Masukkan ChakraHQ Access Token (opsional)"
                  :disabled="isSubmitting"
                />
                <p class="field-hint">Bearer token API ChakraHQ pribadi Anda. Boleh dikosongkan.</p>
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
  password:       '',
  fonnte_token:   '',
  chakra_hq_token: ''
});

// Nilai awal (untuk deteksi perubahan — kecuali password)
const originalForm = reactive({
  name:            '',
  phone:           '',
  birthdate:       '',
  fonnte_token:    '',
  chakra_hq_token: ''
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
// - Salah satu field (name/phone/birthdate/fonnte_token) berbeda dari original, ATAU
// - Password sudah diisi
const hasChanges = computed(() => {
  return (
    form.name            !== originalForm.name            ||
    form.phone           !== originalForm.phone           ||
    form.birthdate       !== originalForm.birthdate       ||
    form.fonnte_token    !== originalForm.fonnte_token    ||
    form.chakra_hq_token !== originalForm.chakra_hq_token ||
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
      form.fonnte_token    = user.fonnte_token    || '';
      form.chakra_hq_token = user.chakra_hq_token || '';
      form.password        = '';

      // Simpan original (tidak termasuk password)
      originalForm.name            = form.name;
      originalForm.phone           = form.phone;
      originalForm.birthdate       = form.birthdate;
      originalForm.fonnte_token    = form.fonnte_token;
      originalForm.chakra_hq_token = form.chakra_hq_token;
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
const validateForm = () => {
  if (!form.name.trim())     return 'Nama wajib diisi';
  if (!form.phone.trim())    return 'Nomor HP wajib diisi';
  if (!form.password.trim()) return 'Password wajib diisi';
  if (form.password.trim().length < 6) return 'Password minimal 6 karakter';
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
      fonnte_token:    form.fonnte_token    || null,
      chakra_hq_token: form.chakra_hq_token || null
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
      originalForm.fonnte_token    = form.fonnte_token;
      originalForm.chakra_hq_token = form.chakra_hq_token;
      form.password                = '';

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

<style scoped>
.profile-section {
  min-height: calc(100vh - 80px);
  padding: 40px 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
}

.profile-card {
  background: white;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

.profile-header {
  text-align: center;
  margin-bottom: 28px;
}

.profile-header h2 {
  font-size: 28px;
  margin: 0 0 8px;
  color: #2d3748;
}

.profile-header p {
  color: #718096;
  margin: 0;
}

/* ── Form ────────────────────────────────────── */
.profile-form .form-group {
  margin-bottom: 18px;
}

.profile-form label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-weight: 500;
  color: #2d3748;
  font-size: 14px;
}

.required {
  color: #e53e3e;
  font-size: 14px;
}

.badge-locked {
  font-size: 11px;
  font-weight: 400;
  color: #718096;
  background: #edf2f7;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.profile-form input {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.profile-form input:focus {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
}

.profile-form input:disabled {
  background-color: #edf2f7;
  cursor: not-allowed;
  color: #718096;
}

.form-control-static {
  background-color: #edf2f7 !important;
  color: #718096;
}

/* ── Password wrapper ────────────────────────── */
.input-password-wrapper {
  position: relative;
}

.input-password-wrapper input {
  padding-right: 48px;
}

.btn-toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-toggle-password:hover {
  opacity: 1;
}

/* ── Field hint ──────────────────────────────── */
.field-hint {
  margin: 5px 0 0;
  font-size: 12px;
  color: #a0aec0;
}

/* ── Divider ─────────────────────────────────── */
.section-divider {
  position: relative;
  text-align: center;
  margin: 8px 0 22px;
}

.section-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e2e8f0;
}

.section-divider span {
  position: relative;
  background: white;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Submit Button ───────────────────────────── */
.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Spinner ─────────────────────────────────── */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Footer ──────────────────────────────────── */
.profile-footer {
  margin-top: 18px;
  text-align: center;
}

.back-link {
  color: #4299e1;
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

/* ── Alert ───────────────────────────────────── */
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 18px;
  font-size: 14px;
}

.alert-danger {
  background-color: #fed7d7;
  color: #742a2a;
  border: 1px solid #feb2b2;
}

.alert-success {
  background-color: #c6f6d5;
  color: #22543d;
  border: 1px solid #9ae6b4;
}

.alert-warning {
  background-color: #fefcbf;
  color: #744210;
  border: 1px solid #faf089;
}

/* ── Loading ─────────────────────────────────── */
.loading-spinner {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

/* ── Responsive ──────────────────────────────── */
@media (max-width: 576px) {
  .profile-card {
    padding: 30px 20px;
  }
}
</style>
