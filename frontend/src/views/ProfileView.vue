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

              <!-- AI Primary — provider yang dipakai di terminal message -->
              <div class="form-group">
                <label class="col-form-label" for="aiPrimary">AI Primary</label>
                <select
                  id="aiPrimary"
                  v-model="form.ai_primary"
                  :disabled="isSubmitting"
                >
                  <option value="Default">Default — ikut setting server</option>
                  <option value="Deepseek">Deepseek</option>
                  <option value="Kimi">Kimi</option>
                </select>
                <p class="field-hint">
                  AI yang menjawab customer di terminal message.
                  <strong>Default</strong> mengikuti setting server (AI_PRIMARY_PROVIDER).
                </p>
              </div>

              <!-- Divider -->
              <div class="section-divider">
                <span>Transaksi & Pembayaran</span>
              </div>

              <!-- Transaction Type -->
              <div class="form-group">
                <label class="col-form-label" for="transType">Transaction Type</label>
                <select
                  id="transType"
                  v-model="form.trans_type"
                  :disabled="isSubmitting"
                >
                  <option value="Both">Both — Jual &amp; Sewa</option>
                  <option value="Sale">Sale — Jual saja</option>
                  <option value="Rent">Rent — Sewa saja</option>
                </select>
                <p class="field-hint">Jenis transaksi yang Anda layani.</p>
              </div>

              <!-- Payment Type — pilihannya TERIKAT Transaction Type -->
              <div class="form-group">
                <label class="col-form-label" for="paymentType">
                  Payment Type
                  <span v-if="paymentLocked" class="badge-locked">🔒 Mengikuti Transaction Type</span>
                </label>
                <select
                  id="paymentType"
                  v-model="form.payment_type"
                  :disabled="isSubmitting || paymentLocked"
                >
                  <option v-for="p in allowedPayments" :key="p" :value="p">{{ p }}</option>
                </select>
                <p class="field-hint">{{ paymentHint }}</p>
              </div>

              <!-- Durasi sewa minimal — hanya untuk Rent / Both -->
              <div v-if="supportsRental" class="form-group">
                <label class="col-form-label" for="rentalDuration">Minimal Durasi Sewa</label>
                <div class="d-flex gap-2">
                  <input
                    id="rentalDuration"
                    v-model="form.rental_duration"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="mis. 3"
                    :disabled="isSubmitting"
                  />
                  <select
                    id="rentalType"
                    v-model="form.rental_type"
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
                <p class="field-hint">
                  Opsional. Isi keduanya atau kosongkan keduanya — mis. <em>3 Month</em>.
                </p>
              </div>

              <!-- Divider -->
              <div class="section-divider">
                <span>Keamanan &amp; Integrasi</span>
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
import { reactive, ref, computed, watch, onMounted } from 'vue';
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
  ai_primary:      'Default',
  trans_type:      'Both',
  payment_type:    'Both',
  rental_duration: '',
  rental_type:     '',
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
  ai_primary:      'Default',
  trans_type:      'Both',
  payment_type:    'Both',
  rental_duration: '',
  rental_type:     '',
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

/* ── Aturan trans_type ↔ payment_type ↔ rental_* ──────────────────────────
   CERMIN dari backend/utils/userBusinessRules.js. UI hanya mencegah pilihan
   mustahil lebih awal — backend TETAP satu-satunya penentu (UI bisa dilewati). */
const PAYMENT_BY_TRANS = {
  Rent: ['Cash'],          // sewa tidak dibiayai KPR
  Both: ['Both'],
  Sale: ['Cash', 'KPR', 'Both'],
};

const allowedPayments = computed(() => PAYMENT_BY_TRANS[form.trans_type] || ['Cash']);

// Rent & Both hanya punya SATU opsi sah → dikunci, biar jelas bahwa nilainya
// mengikuti Transaction Type dan bukan sesuatu yang user lupa isi.
const paymentLocked = computed(() => allowedPayments.value.length === 1);

const supportsRental = computed(() => form.trans_type === 'Rent' || form.trans_type === 'Both');

const paymentHint = computed(() => {
  if (form.trans_type === 'Rent') return 'Transaksi Rent selalu Cash — sewa tidak dibiayai KPR.';
  if (form.trans_type === 'Both') return 'Transaksi Both selalu Both (Cash dan KPR).';
  return 'Untuk Sale, Anda bebas memilih Cash, KPR, atau Both.';
});

// Jaga agar form tidak pernah menampilkan kombinasi mustahil saat Transaction
// Type diganti — mis. Sale/KPR lalu pindah ke Rent (KPR tidak lagi sah).
watch(() => form.trans_type, () => {
  if (!allowedPayments.value.includes(form.payment_type)) {
    form.payment_type = allowedPayments.value[0];
  }
  if (!supportsRental.value) {
    form.rental_duration = '';
    form.rental_type     = '';
  }
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
    form.ai_primary      !== originalForm.ai_primary      ||
    form.trans_type      !== originalForm.trans_type      ||
    form.payment_type    !== originalForm.payment_type    ||
    String(form.rental_duration ?? '') !== String(originalForm.rental_duration ?? '') ||
    String(form.rental_type ?? '')     !== String(originalForm.rental_type ?? '')     ||
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
      form.ai_primary       = user.ai_primary       || 'Default';
      form.trans_type       = user.trans_type       || 'Both';
      form.payment_type     = user.payment_type     || 'Both';
      form.rental_duration  = user.rental_duration ?? '';
      form.rental_type      = user.rental_type      || '';
      form.fonnte_token     = user.fonnte_token     || '';
      form.kirimi_device_id = user.kirimi_device_id || '';
      form.password         = '';

      // Simpan original (tidak termasuk password)
      originalForm.name             = form.name;
      originalForm.phone            = form.phone;
      originalForm.birthdate        = form.birthdate;
      originalForm.email            = form.email;
      originalForm.catalog_summary  = form.catalog_summary;
      originalForm.ai_primary       = form.ai_primary;
      originalForm.trans_type       = form.trans_type;
      originalForm.payment_type     = form.payment_type;
      originalForm.rental_duration  = form.rental_duration;
      originalForm.rental_type      = form.rental_type;
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
      ai_primary:       form.ai_primary       || 'Default',
      trans_type:       form.trans_type       || 'Both',
      payment_type:     form.payment_type     || null,
      // Kosong dikirim sebagai null (bukan "") supaya backend membacanya sebagai
      // "tidak diisi", bukan sebagai nilai kosong yang tidak valid.
      rental_duration:  form.rental_duration === '' || form.rental_duration === null ? null : Number(form.rental_duration),
      rental_type:      form.rental_type      || null,
      fonnte_token:     form.fonnte_token     || null,
      kirimi_device_id: form.kirimi_device_id || null
      // username TIDAK dikirim — backend mengabaikannya
    };

    const result = await updateProfile(payload);

    if (result?.isSuccess === 1 && result?.data?.response?.user) {
      setAlert('success', result?.data?.message || 'Profil berhasil diupdate');
      toast.success(result?.data?.message || 'Profil berhasil diupdate');

      // Backend MENORMALKAN field yang saling terikat (mis. trans_type "Sale"
      // mengosongkan rental_*, "Both" memaksa payment_type "Both"). Ambil hasil
      // akhir dari respons, bukan dari form lokal — kalau tidak, layar bisa
      // menampilkan nilai yang berbeda dari yang benar-benar tersimpan.
      const saved = result.data.response.user;
      form.trans_type      = saved.trans_type      || form.trans_type;
      form.payment_type    = saved.payment_type    || form.payment_type;
      form.ai_primary      = saved.ai_primary      || form.ai_primary;
      form.rental_duration = saved.rental_duration ?? '';
      form.rental_type     = saved.rental_type     || '';

      // Reset original values & kosongkan password
      originalForm.name            = form.name;
      originalForm.phone           = form.phone;
      originalForm.birthdate       = form.birthdate;
      originalForm.email           = form.email;
      originalForm.catalog_summary = form.catalog_summary;
      originalForm.ai_primary      = form.ai_primary;
      originalForm.trans_type      = form.trans_type;
      originalForm.payment_type    = form.payment_type;
      originalForm.rental_duration = form.rental_duration;
      originalForm.rental_type     = form.rental_type;
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
