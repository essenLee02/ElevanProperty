<template>
  <div class="auth-page">

    <!-- ── Visual Side (desktop only) ─────────────────── -->
    <div class="auth-visual">
      <div class="auth-visual-bg"></div>
      <div class="auth-visual-content">
        <div class="auth-visual-brand">
          <div class="auth-logo-icon">E</div>
          <span class="auth-logo-text">Elevan <span>Property</span></span>
        </div>
        <blockquote class="auth-visual-quote">
          "Temukan properti <span>impian</span> Anda dengan bantuan AI terpercaya."
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
    <div class="auth-form-side">
      <div class="auth-form-container">

        <!-- Mobile logo -->
        <div class="auth-logo-mark d-lg-none">
          <div class="auth-logo-icon">E</div>
          <span class="auth-logo-text">Elevan <span>Property</span></span>
        </div>

        <div class="auth-heading">
          <h2>Selamat Datang</h2>
          <p>Masuk ke akun Elevan Property Anda</p>
        </div>

        <!-- Alert -->
        <div
          v-if="alert.message"
          :class="['alert', `alert-${alert.type}`]"
          role="alert"
          aria-live="polite"
        >
          <i :class="alertIcon" style="flex-shrink:0;"></i>
          <span>{{ alert.message }}</span>
        </div>

        <!-- Form -->
        <form @submit.prevent="submitLogin" class="auth-form" novalidate>

          <!-- Username -->
          <div class="form-group">
            <label class="form-label col-form-label" for="username">
              Username <span class="required">*</span>
            </label>
            <div class="input-icon-wrapper">
              <i class="fa-regular fa-user input-icon"></i>
              <input
                id="username"
                v-model.trim="form.username"
                type="text"
                class="form-control form-control-lg form-control-sm"
                placeholder="Masukkan username"
                autocomplete="username"
                :disabled="isSubmitting"
                required
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
                placeholder="Masukkan password"
                autocomplete="current-password"
                :disabled="isSubmitting"
                required
              />
              <button
                type="button"
                class="btn-password-toggle"
                @click="showPassword = !showPassword"
                :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
              >
                <i :class="showPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
              </button>
            </div>
          </div>

          <!-- Submit -->
          <button type="submit" class="btn-auth" :disabled="isSubmitting">
            <span v-if="isSubmitting">
              <span class="spinner-sm"></span>&nbsp; Memverifikasi...
            </span>
            <span v-else>
              <i class="fa-solid fa-arrow-right-to-bracket"></i>&nbsp; Masuk
            </span>
          </button>

        </form>

        <p class="auth-footer-link">
          Belum punya akun?
          <router-link to="/register">Daftar sekarang</router-link>
        </p>

      </div>
    </div>

  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { loginUser } from '../services/authApi';

/* ── Constants ─────────────────────────────────────────── */
const features = [
  'Akses 7.900+ listing properti di 36 provinsi',
  'AI chatbot siap membantu 24/7 via WhatsApp',
  '5 agent berpengalaman siap mendampingi',
  'Data properti akurat dan selalu diperbarui',
];

/* ── State ─────────────────────────────────────────────── */
const router       = useRouter();
const form         = reactive({ username: '', password: '' });
const alert        = reactive({ type: '', message: '' });
const isSubmitting = ref(false);
const showPassword = ref(false);

/* ── Computed ──────────────────────────────────────────── */
const alertIcon = computed(() => ({
  'fa-solid fa-circle-check'       : alert.type === 'success',
  'fa-solid fa-triangle-exclamation': alert.type === 'warning',
  'fa-solid fa-circle-xmark'       : alert.type === 'danger',
  'fa-solid fa-circle-info'        : alert.type === 'info',
}));

/* ── Helpers ───────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

/* ── Validation ────────────────────────────────────────── */
const validateForm = () => {
  if (!form.username) return 'Username wajib diisi';
  if (!form.password) return 'Password wajib diisi';
  return '';
};

/* ── Submit ────────────────────────────────────────────── */
const submitLogin = async () => {
  clearAlert();

  const errMsg = validateForm();
  if (errMsg) { setAlert('warning', errMsg); return; }

  isSubmitting.value = true;
  try {
    const result = await loginUser({ username: form.username, password: form.password });

    if (result?.isSuccess === 1) {
      setAlert('success', result?.data?.message || 'Login berhasil!');
      toast.success(result?.data?.message || 'Login berhasil!');
      setTimeout(() => router.push('/'), 700);
    } else {
      setAlert('danger', result?.data?.message || 'Username atau password salah');
    }
  } catch (error) {
    const msg = error?.response?.data?.data?.message
              || error?.response?.data?.message
              || 'Login gagal, silakan coba lagi';
    setAlert('danger', msg);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
