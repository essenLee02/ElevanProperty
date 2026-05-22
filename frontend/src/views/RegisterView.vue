<template>
  <section class="auth-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-6 col-lg-7 col-md-9">
          <div class="auth-card">
            <div class="auth-header">
              <h2>Create Account</h2>
              <p>Daftar akun baru di Elevan Property</p>
            </div>

            <!-- Alert pesan -->
            <div
              v-if="alert.message"
              :class="['alert', alertClass]"
              role="alert"
            >
              <div>{{ alert.message }}</div>
              <div v-if="resultUserId" class="user-id-info">
                User ID Anda: <strong>{{ resultUserId }}</strong>
                <br>
                <small>Anda akan diarahkan ke halaman login...</small>
              </div>
            </div>

            <form @submit.prevent="submitRegister" class="auth-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="name">Nama Lengkap *</label>
                  <input
                    id="name"
                    v-model.trim="form.name"
                    type="text"
                    placeholder="Nigel Tjandra"
                    :disabled="isSubmitting"
                  />
                </div>

                <div class="form-group">
                  <label for="birthdate">Tanggal Lahir</label>
                  <input
                    id="birthdate"
                    v-model="form.birthdate"
                    type="date"
                    :disabled="isSubmitting"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="phone">Phone</label>
                  <input
                    id="phone"
                    v-model.trim="form.phone"
                    type="tel"
                    placeholder="08123456789"
                    @input="sanitizePhone"
                    :disabled="isSubmitting"
                  />
                </div>

                <div class="form-group">
                  <label for="username">Username *</label>
                  <input
                    id="username"
                    v-model.trim="form.username"
                    type="text"
                    placeholder="username unik"
                    autocomplete="username"
                    :disabled="isSubmitting"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="password">Password *</label>
                <div class="password-wrapper">
                  <input
                    id="password"
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Minimal 6 karakter"
                    autocomplete="new-password"
                    :disabled="isSubmitting"
                  />
                  <button
                    type="button"
                    class="reveal-btn"
                    @click="showPassword = !showPassword"
                  >
                    {{ showPassword ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label for="konfirmasi">Konfirmasi Password *</label>
                <div class="password-wrapper">
                  <input
                    id="konfirmasi"
                    v-model="form.konfirmasi"
                    :type="showConfirm ? 'text' : 'password'"
                    placeholder="Ulangi password"
                    autocomplete="new-password"
                    :disabled="isSubmitting"
                  />
                  <button
                    type="button"
                    class="reveal-btn"
                    @click="showConfirm = !showConfirm"
                  >
                    {{ showConfirm ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Mendaftar...' : 'Daftar Sekarang' }}
              </button>

              <div class="auth-footer">
                Sudah punya akun?
                <router-link to="/login" class="auth-link">Login di sini</router-link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import { registerUser } from '../services/authApi';

const router = useRouter();

const form = reactive({
  name:       '',
  birthdate:  '',
  phone:      '',
  username:   '',
  password:   '',
  konfirmasi: ''
});

const alert = reactive({ type: '', message: '' });
const isSubmitting  = ref(false);
const showPassword  = ref(false);
const showConfirm   = ref(false);
const resultUserId  = ref('');

const PHONE_REGEX = /[^0-9+\-\s]/g;

const alertClass = computed(() => {
  if (alert.type === 'success') return 'alert-success';
  if (alert.type === 'warning') return 'alert-warning';
  return 'alert-danger';
});

const setAlert = (type, message) => {
  alert.type = type;
  alert.message = message;
};
const clearAlert = () => {
  alert.type = '';
  alert.message = '';
  resultUserId.value = '';
};

const sanitizePhone = (event) => {
  form.phone = String(event?.target?.value || form.phone).replace(PHONE_REGEX, '');
};

const validateForm = () => {
  if (!form.name)       return 'Nama wajib diisi';
  if (!form.username)   return 'Username wajib diisi';
  if (!form.password)   return 'Password wajib diisi';
  if (!form.konfirmasi) return 'Konfirmasi password wajib diisi';
  if (form.password.length < 6) return 'Password minimal 6 karakter';
  if (form.password !== form.konfirmasi) return 'Password dan Konfirmasi tidak cocok';
  return '';
};

const submitRegister = async () => {
  clearAlert();
  const errorMsg = validateForm();
  if (errorMsg) {
    setAlert('warning', errorMsg);
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      name:       form.name,
      birthdate:  form.birthdate || null,
      phone:      form.phone || null,
      username:   form.username,
      password:   form.password,
      konfirmasi: form.konfirmasi,
      privilege:  null,
      createdBy:  'Self-Register'
    };

    const result = await registerUser(payload);

    if (result?.isSuccess === 1) {
      const user = result?.data?.response;
      resultUserId.value = user?.user_id || '';
      setAlert('success', result?.data?.message || 'Sukses register');
      toast.success(result?.data?.message || 'Sukses register');

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } else {
      setAlert('danger', result?.data?.message || 'Register gagal');
    }
  } catch (error) {
    const backendMessage = error?.response?.data?.data?.message
      || error?.response?.data?.message
      || error?.message
      || 'Register gagal, coba lagi';
    setAlert('danger', backendMessage);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.auth-section {
  min-height: calc(100vh - 80px);
  padding: 60px 0;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
}
.auth-card {
  background: white;
  border-radius: 16px;
  padding: 40px 32px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}
.auth-header {
  text-align: center;
  margin-bottom: 28px;
}
.auth-header h2 {
  font-size: 28px;
  margin: 0 0 8px;
  color: #2d3748;
}
.auth-header p {
  color: #718096;
  margin: 0;
}
.auth-form .form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.auth-form .form-group {
  margin-bottom: 18px;
}
.auth-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #2d3748;
  font-size: 14px;
}
.auth-form input {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}
.auth-form input:focus {
  border-color: #4299e1;
}
.password-wrapper {
  position: relative;
}
.password-wrapper input {
  padding-right: 44px;
}
.reveal-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
}
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
}
.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.auth-footer {
  margin-top: 18px;
  text-align: center;
  color: #4a5568;
  font-size: 14px;
}
.auth-link {
  color: #4299e1;
  font-weight: 600;
  text-decoration: none;
}
.auth-link:hover {
  text-decoration: underline;
}
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
.user-id-info {
  margin-top: 8px;
  font-size: 13px;
}
@media (max-width: 576px) {
  .auth-form .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
