<template>
  <section class="auth-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-5 col-lg-6 col-md-8">
          <div class="auth-card">
            <div class="auth-header">
              <h2>Welcome Back</h2>
              <p>Login ke akun Elevan Property Anda</p>
            </div>

            <!-- Alert pesan -->
            <div
              v-if="alert.message"
              :class="['alert', alertClass]"
              role="alert"
            >
              {{ alert.message }}
            </div>

            <form @submit.prevent="submitLogin" class="auth-form">
              <div class="form-group">
                <label for="username">Username</label>
                <input
                  id="username"
                  v-model.trim="form.username"
                  type="text"
                  placeholder="Masukkan username"
                  autocomplete="username"
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-group">
                <label for="password">Password</label>
                <div class="password-wrapper">
                  <input
                    id="password"
                    v-model="form.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="Masukkan password"
                    autocomplete="current-password"
                    :disabled="isSubmitting"
                  />
                  <button
                    type="button"
                    class="reveal-btn"
                    @click="showPassword = !showPassword"
                    :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  >
                    {{ showPassword ? '🙈' : '👁️' }}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Login...' : 'Sign In' }}
              </button>

              <div class="auth-footer">
                Belum punya akun?
                <router-link to="/register" class="auth-link">Daftar di sini</router-link>
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
import { loginUser } from '../services/authApi';

const router = useRouter();

const form = reactive({ username: '', password: '' });
const alert = reactive({ type: '', message: '' });
const isSubmitting = ref(false);
const showPassword = ref(false);

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
};

const validateForm = () => {
  if (!form.username) return 'Username wajib diisi';
  if (!form.password) return 'Password wajib diisi';
  return '';
};

const submitLogin = async () => {
  clearAlert();
  const errorMsg = validateForm();
  if (errorMsg) {
    setAlert('warning', errorMsg);
    return;
  }

  isSubmitting.value = true;
  try {
    const result = await loginUser({
      username: form.username,
      password: form.password
    });

    // Backend format: { status, data: { response, message }, isSuccess }
    if (result?.isSuccess === 1) {
      setAlert('success', result?.data?.message || 'Login berhasil');
      toast.success(result?.data?.message || 'Login berhasil');
      // Redirect ke home setelah 800ms
      setTimeout(() => {
        router.push('/');
      }, 800);
    } else {
      const msg = result?.data?.message || 'Login gagal';
      setAlert('danger', msg);
    }
  } catch (error) {
    const backendMessage = error?.response?.data?.data?.message
      || error?.response?.data?.message
      || error?.message
      || 'Login gagal, coba lagi';
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
.auth-form .form-group {
  margin-bottom: 18px;
}
.auth-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #2d3748;
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
  transition: opacity 0.2s, transform 0.1s;
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
</style>
