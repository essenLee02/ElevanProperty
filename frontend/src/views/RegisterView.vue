<template>
  <div class="auth-page">

    <!-- ── Visual Side ────────────────────────────────── -->
    <div class="auth-visual">
      <div class="auth-visual-bg"></div>
      <div class="auth-visual-content">
        <div class="auth-visual-brand">
          <div class="auth-logo-icon">E</div>
          <span class="auth-logo-text">Elevan <span>Property</span></span>
        </div>
        <blockquote class="auth-visual-quote">
          "Bergabunglah dan kelola properti dengan lebih <span>efisien</span>."
        </blockquote>
        <div class="auth-visual-features">
          <div v-for="f in features" :key="f" class="auth-visual-feature">
            <div class="check-icon"><i class="fa-solid fa-check" style="font-size:.6rem;"></i></div>
            <span>{{ f }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Form Side ──────────────────────────────────── -->
    <div class="auth-form-side" style="max-width:560px;">
      <div class="auth-form-container" style="max-width:460px;">

        <!-- Mobile logo -->
        <div class="auth-logo-mark d-lg-none">
          <div class="auth-logo-icon">E</div>
          <span class="auth-logo-text">Elevan <span>Property</span></span>
        </div>

        <div class="auth-heading">
          <h2>Buat Akun</h2>
          <p>Daftar sebagai agent Elevan Property</p>
        </div>

        <!-- Alert -->
        <div
          v-if="alert.message"
          :class="['alert', `alert-${alert.type}`]"
          role="alert"
          aria-live="polite"
        >
          <i :class="alertIcon" style="flex-shrink:0;"></i>
          <div>
            <span>{{ alert.message }}</span>
            <div v-if="resultUserId" style="margin-top:6px;font-size:.8rem;">
              User ID Anda: <strong>{{ resultUserId }}</strong><br>
              <small style="opacity:.8;">Mengarahkan ke halaman login...</small>
            </div>
          </div>
        </div>

        <form @submit.prevent="submitRegister" class="auth-form" novalidate>

          <!-- Row: Nama + Tanggal Lahir -->
          <div class="row g-3 mb-0">
            <div class="col-sm-7">
              <div class="form-group">
                <label class="form-label col-form-label" for="name">
                  Nama Lengkap <span class="required">*</span>
                </label>
                <div class="input-icon-wrapper">
                  <i class="fa-regular fa-id-card input-icon"></i>
                  <input
                    id="name"
                    v-model.trim="form.name"
                    type="text"
                    class="form-control form-control-lg form-control-sm"
                    placeholder="Nama lengkap Anda"
                    :disabled="isSubmitting"
                    required
                  />
                </div>
              </div>
            </div>
            <div class="col-sm-5">
              <div class="form-group">
                <label class="form-label col-form-label" for="birthdate">Tanggal Lahir</label>
                <input
                  id="birthdate"
                  v-model="form.birthdate"
                  type="date"
                  class="form-control"
                  :disabled="isSubmitting"
                />
              </div>
            </div>
          </div>

          <!-- Row: Phone + Username -->
          <div class="row g-3 mb-0">
            <div class="col-sm-5">
              <div class="form-group">
                <label class="form-label col-form-label" for="phone">No. Telepon</label>
                <div class="input-icon-wrapper">
                  <i class="fa-solid fa-phone input-icon"></i>
                  <input
                    id="phone"
                    v-model.trim="form.phone"
                    type="tel"
                    class="form-control form-control-lg form-control-sm"
                    placeholder="08123..."
                    @input="sanitizePhone"
                    :disabled="isSubmitting"
                  />
                </div>
              </div>
            </div>
            <div class="col-sm-7">
              <div class="form-group">
                <label class="form-label col-form-label" for="username">
                  Username <span class="required">*</span>
                </label>
                <div class="input-icon-wrapper">
                  <i class="fa-solid fa-at input-icon"></i>
                  <input
                    id="username"
                    v-model.trim="form.username"
                    type="text"
                    class="form-control form-control-lg form-control-sm"
                    placeholder="Username unik"
                    autocomplete="username"
                    :disabled="isSubmitting"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Email -->
          <div class="form-group">
            <label class="form-label col-form-label" for="email">Email</label>
            <div class="input-icon-wrapper">
              <i class="fa-regular fa-envelope input-icon"></i>
              <input
                id="email"
                v-model.trim="form.email"
                type="email"
                class="form-control form-control-lg form-control-sm"
                placeholder="nama@email.com"
                autocomplete="email"
                :disabled="isSubmitting"
              />
            </div>
          </div>

          <!-- Password -->
          <div class="form-group">
            <label class="form-label col-form-label" for="password">
              Password <span class="required">*</span>
            </label>
            <div class="input-password-wrapper">
              <input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-control form-control-lg form-control-sm"
                placeholder="Min. 6 karakter"
                autocomplete="new-password"
                :disabled="isSubmitting"
                required
              />
              <button
                type="button"
                class="btn-password-toggle"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Sembunyikan' : 'Tampilkan'"
              >
                <i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
              </button>
            </div>
          </div>

          <!-- Konfirmasi Password -->
          <div class="form-group">
            <label class="form-label col-form-label" for="konfirmasi">
              Konfirmasi Password <span class="required">*</span>
            </label>
            <div class="input-password-wrapper">
              <input
                id="konfirmasi"
                v-model="form.konfirmasi"
                :type="showConfirm ? 'text' : 'password'"
                class="form-control form-control-lg form-control-sm"
                :class="{ 'is-invalid': form.konfirmasi && form.password !== form.konfirmasi }"
                placeholder="Ulangi password"
                autocomplete="new-password"
                :disabled="isSubmitting"
                required
              />
              <button
                type="button"
                class="btn-password-toggle"
                @click="showConfirm = !showConfirm"
                :aria-label="showConfirm ? 'Sembunyikan' : 'Tampilkan'"
              >
                <i :class="showConfirm ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
              </button>
            </div>
            <p
              v-if="form.konfirmasi && form.password !== form.konfirmasi"
              class="form-hint" style="color:var(--danger);"
            >
              <i class="fa-solid fa-triangle-exclamation"></i> Password tidak cocok
            </p>
          </div>

          <!-- Submit -->
          <button type="submit" class="btn-auth" :disabled="isSubmitting">
            <span v-if="isSubmitting">
              <span class="spinner-sm"></span>&nbsp; Mendaftarkan...
            </span>
            <span v-else>
              <i class="fa-solid fa-user-plus"></i>&nbsp; Daftar Sekarang
            </span>
          </button>

        </form>

        <p class="auth-footer-link">
          Sudah punya akun?
          <router-link to="/login">Masuk di sini</router-link>
        </p>

      </div>
    </div>

  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { registerUser } from '../services/authApi';

/* ── Constants ─────────────────────────────────────────── */
const features = [
  'Akses dashboard agent properti pribadi',
  'Kelola percakapan WhatsApp pelanggan',
  'Pantau listing properti real-time',
  'Laporan dan statistik penjualan',
];

const PHONE_REGEX = /[^0-9+\-\s]/g;

/* ── State ─────────────────────────────────────────────── */
const router       = useRouter();
const form         = reactive({ name: '', birthdate: '', phone: '', username: '', email: '', password: '', konfirmasi: '' });
const alert        = reactive({ type: '', message: '' });
const isSubmitting = ref(false);
const showPassword = ref(false);
const showConfirm  = ref(false);
const resultUserId = ref('');

/* ── Computed ──────────────────────────────────────────── */
const alertIcon = computed(() => ({
  'fa-solid fa-circle-check'       : alert.type === 'success',
  'fa-solid fa-triangle-exclamation': alert.type === 'warning',
  'fa-solid fa-circle-xmark'       : alert.type === 'danger',
}));

/* ── Helpers ───────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; resultUserId.value = ''; };

/** Remove non-phone characters from input */
const sanitizePhone = (e) => { form.phone = String(e?.target?.value || form.phone).replace(PHONE_REGEX, ''); };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Validation ────────────────────────────────────────── */
const validateForm = () => {
  if (!form.name)                              return 'Nama lengkap wajib diisi';
  if (!form.username)                          return 'Username wajib diisi';
  if (form.email && !EMAIL_REGEX.test(form.email)) return 'Format email tidak valid';
  if (!form.password)                          return 'Password wajib diisi';
  if (form.password.length < 6)               return 'Password minimal 6 karakter';
  if (!form.konfirmasi)                        return 'Konfirmasi password wajib diisi';
  if (form.password !== form.konfirmasi)       return 'Password dan konfirmasi tidak cocok';
  return '';
};

/* ── Submit ────────────────────────────────────────────── */
const submitRegister = async () => {
  clearAlert();

  const errMsg = validateForm();
  if (errMsg) { setAlert('warning', errMsg); return; }

  isSubmitting.value = true;
  try {
    const result = await registerUser({
      name      : form.name,
      birthdate : form.birthdate || null,
      phone     : form.phone    || null,
      username  : form.username,
      email     : form.email    || null,
      password  : form.password,
      konfirmasi: form.konfirmasi,
      privilege : null,
      createdBy : 'Self-Register',
    });

    if (result?.isSuccess === 1) {
      resultUserId.value = result?.data?.response?.user_id || '';
      setAlert('success', result?.data?.message || 'Registrasi berhasil!');
      toast.success(result?.data?.message || 'Registrasi berhasil!');
      setTimeout(() => router.push('/login'), 2200);
    } else {
      setAlert('danger', result?.data?.message || 'Registrasi gagal');
    }
  } catch (error) {
    const msg = error?.response?.data?.data?.message
              || error?.response?.data?.message
              || 'Registrasi gagal, silakan coba lagi';
    setAlert('danger', msg);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
