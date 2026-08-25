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

          <!-- Developer / Agensi asal agent -->
          <div class="form-group">
            <label class="form-label col-form-label" for="developerProperty">Developer / Agensi</label>
            <select
              id="developerProperty"
              v-model="form.developer_property_id"
              class="form-control form-control-lg form-control-sm"
              :disabled="isSubmitting || isLoadingDevelopers"
            >
              <option value="">— Tidak berafiliasi (agent independen) —</option>
              <option
                v-for="d in developerOptions"
                :key="d.developer_property_id"
                :value="d.developer_property_id"
              >{{ d.name }}</option>
            </select>
            <small class="text-muted">
              <template v-if="isLoadingDevelopers">Memuat daftar developer…</template>
              <template v-else-if="developerOptions.length">Brand agensi asal agent (Ray White, Brighton, dll). Boleh dikosongkan.</template>
              <template v-else>Belum ada developer aktif di master — bisa diisi nanti lewat halaman Profile.</template>
            </small>
          </div>

          <!-- AI Primary -->
          <div class="form-group">
            <label class="form-label col-form-label" for="aiPrimary">AI Primary</label>
            <select
              id="aiPrimary"
              v-model="form.ai_primary"
              class="form-control form-control-lg form-control-sm"
              :disabled="isSubmitting"
            >
              <option value="Default">Default — ikut setting server</option>
              <option value="Deepseek">Deepseek</option>
              <option value="Kimi">Kimi</option>
            </select>
            <small class="text-muted">AI yang menjawab customer di terminal message.</small>
          </div>

          <!-- Transaction Type -->
          <div class="form-group">
            <label class="form-label col-form-label" for="transType">Transaction Type</label>
            <select
              id="transType"
              v-model="form.trans_type"
              class="form-control form-control-lg form-control-sm"
              :disabled="isSubmitting"
            >
              <option value="Both">Both — Jual &amp; Sewa</option>
              <option value="Sale">Sale — Jual saja</option>
              <option value="Rent">Rent — Sewa saja</option>
            </select>
          </div>

          <!-- Payment Type — pilihannya TERIKAT Transaction Type -->
          <div class="form-group">
            <label class="form-label col-form-label" for="paymentType">
              Payment Type
              <span v-if="paymentLocked" class="badge-locked">🔒 Mengikuti Transaction Type</span>
            </label>
            <select
              id="paymentType"
              v-model="form.payment_type"
              class="form-control form-control-lg form-control-sm"
              :disabled="isSubmitting || paymentLocked"
            >
              <option v-for="p in allowedPayments" :key="p" :value="p">{{ p }}</option>
            </select>
            <small class="text-muted">{{ paymentHint }}</small>
          </div>

          <!-- Minimal durasi sewa — hanya untuk Rent / Both -->
          <div v-if="supportsRental" class="form-group">
            <label class="form-label col-form-label" for="rentalDuration">Minimal Durasi Sewa</label>
            <div class="d-flex gap-2">
              <input
                id="rentalDuration"
                v-model="form.rental_duration"
                type="number"
                min="1"
                step="1"
                class="form-control form-control-lg form-control-sm"
                placeholder="mis. 3"
                :disabled="isSubmitting"
              />
              <select
                id="rentalType"
                v-model="form.rental_type"
                class="form-control form-control-lg form-control-sm"
                :disabled="isSubmitting"
              >
                <option value="">— satuan —</option>
                <option value="Day">Day</option>
                <option value="Week">Week</option>
                <option value="Month">Month</option>
                <option value="Year">Year</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <small class="text-muted">Opsional. Isi keduanya atau kosongkan keduanya — mis. 3 Month.</small>
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
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { registerUser } from '../services/authApi';
import { getDeveloperPropertyOptions } from '../services/developerPropertyApi';

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
const form         = reactive({
  name: '', birthdate: '', phone: '', username: '', email: '',
  developer_property_id: '',
  ai_primary: 'Default', trans_type: 'Both', payment_type: 'Both',
  rental_duration: '', rental_type: '',
  password: '', konfirmasi: '',
});

/* ── Aturan trans_type <-> payment_type <-> rental_* ────────────────────────
   CERMIN dari backend/utils/userBusinessRules.js. UI mencegah kombinasi
   mustahil lebih awal; backend tetap penentu akhir. */
const PAYMENT_BY_TRANS = {
  Rent: ['Cash'],          // sewa tidak dibiayai KPR
  Both: ['Both'],
  Sale: ['Cash', 'KPR', 'Both'],
};
const allowedPayments = computed(() => PAYMENT_BY_TRANS[form.trans_type] || ['Cash']);
const paymentLocked   = computed(() => allowedPayments.value.length === 1);
const supportsRental  = computed(() => form.trans_type === 'Rent' || form.trans_type === 'Both');
const paymentHint     = computed(() => {
  if (form.trans_type === 'Rent') return 'Transaksi Rent selalu Cash - sewa tidak dibiayai KPR.';
  if (form.trans_type === 'Both') return 'Transaksi Both selalu Both (Cash dan KPR).';
  return 'Untuk Sale, Anda bebas memilih Cash, KPR, atau Both.';
});
watch(() => form.trans_type, () => {
  if (!allowedPayments.value.includes(form.payment_type)) {
    form.payment_type = allowedPayments.value[0];
  }
  if (!supportsRental.value) {
    form.rental_duration = '';
    form.rental_type     = '';
  }
});
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
      developer_property_id: form.developer_property_id || null,
      ai_primary  : form.ai_primary   || 'Default',
      trans_type  : form.trans_type   || 'Both',
      payment_type: form.payment_type || null,
      rental_duration: form.rental_duration === '' || form.rental_duration === null ? null : Number(form.rental_duration),
      rental_type : form.rental_type  || null,
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

/* ── Developer / agensi asal agent — diisi saat register supaya AI bisa
   menjawab "agent ini dari agensi mana?" dari DATA sejak hari pertama.
   Fail-open: master gagal dimuat → daftar kosong, register tetap jalan. */
const developerOptions    = ref([]);
const isLoadingDevelopers = ref(false);

onMounted(async () => {
  isLoadingDevelopers.value = true;
  try {
    const res = await getDeveloperPropertyOptions();
    developerOptions.value = res?.isSuccess === 1 ? (res.data.response.options || []) : [];
  } catch (_) {
    developerOptions.value = [];
  } finally {
    isLoadingDevelopers.value = false;
  }
});
</script>
