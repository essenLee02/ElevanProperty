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

              <div class="form-group">
                <label for="name">Nama Lengkap *</label>
                <input
                  id="name"
                  v-model.trim="form.name"
                  type="text"
                  placeholder="Nama lengkap"
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-group">
                <label for="username">Username *</label>
                <input
                  id="username"
                  v-model.trim="form.username"
                  type="text"
                  placeholder="Username unik"
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="phone">Nomor HP</label>
                  <input
                    id="phone"
                    v-model.trim="form.phone"
                    type="tel"
                    placeholder="08123456789"
                    :disabled="isSubmitting"
                    @input="sanitizePhone"
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

              <button
                type="submit"
                class="btn-primary"
                :disabled="isSubmitting || !hasChanges"
              >
                {{ isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan' }}
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

const form = reactive({
  user_id: '',
  name: '',
  username: '',
  phone: '',
  birthdate: ''
});

const originalForm = reactive({
  user_id: '',
  name: '',
  username: '',
  phone: '',
  birthdate: ''
});

const alert = reactive({ type: '', message: '' });
const isLoading = ref(true);
const isSubmitting = ref(false);

const PHONE_REGEX = /[^0-9+\-\s]/g;

const alertClass = computed(() => {
  if (alert.type === 'success') return 'alert-success';
  if (alert.type === 'warning') return 'alert-warning';
  return 'alert-danger';
});

const hasChanges = computed(() => {
  return (
    form.name !== originalForm.name ||
    form.username !== originalForm.username ||
    form.phone !== originalForm.phone ||
    form.birthdate !== originalForm.birthdate
  );
});

const setAlert = (type, message) => {
  alert.type = type;
  alert.message = message;
};

const clearAlert = () => {
  alert.type = '';
  alert.message = '';
};

const sanitizePhone = (event) => {
  form.phone = String(event?.target?.value || form.phone).replace(PHONE_REGEX, '');
};

const loadProfile = async () => {
  isLoading.value = true;
  clearAlert();
  try {
    const result = await getCurrentProfile();

    // Response structure: { status, data: { response: { user }, message }, isSuccess }
    if (result?.isSuccess === 1 && result?.data?.response?.user) {
      const user = result.data.response.user;
      form.user_id = user.user_id || '';
      form.name = user.name || '';
      form.username = user.username || '';
      form.phone = user.phone || '';
      form.birthdate = user.birthdate ? user.birthdate.split('T')[0] : '';

      // Store original values
      originalForm.user_id = form.user_id;
      originalForm.name = form.name;
      originalForm.username = form.username;
      originalForm.phone = form.phone;
      originalForm.birthdate = form.birthdate;
    } else {
      setAlert('danger', result?.data?.message || 'Gagal memuat profil');
      setTimeout(() => router.push('/login'), 2000);
    }
  } catch (error) {
    const backendMessage =
      error?.response?.data?.data?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Gagal memuat profil';
    setAlert('danger', backendMessage);
    setTimeout(() => router.push('/login'), 2000);
  } finally {
    isLoading.value = false;
  }
};

const validateForm = () => {
  if (!form.name || !form.name.trim()) return 'Nama wajib diisi';
  if (!form.username || !form.username.trim()) return 'Username wajib diisi';
  return '';
};

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
      name: form.name,
      username: form.username,
      phone: form.phone || null,
      birthdate: form.birthdate || null
    };

    const result = await updateProfile(payload);

    // Response structure: { status, data: { response: { user }, message }, isSuccess }
    if (result?.isSuccess === 1 && result?.data?.response?.user) {
      setAlert('success', result?.data?.message || 'Profil berhasil diupdate');
      toast.success(result?.data?.message || 'Profil berhasil diupdate');

      // Update original values
      originalForm.name = form.name;
      originalForm.username = form.username;
      originalForm.phone = form.phone;
      originalForm.birthdate = form.birthdate;

      setTimeout(() => {
        clearAlert();
      }, 3000);
    } else {
      setAlert('danger', result?.data?.message || 'Gagal update profil');
    }
  } catch (error) {
    const backendMessage =
      error?.response?.data?.data?.message ||
      error?.response?.data?.message ||
      error?.message ||
      'Gagal update profil';
    setAlert('danger', backendMessage);
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

.profile-form .form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.profile-form .form-group {
  margin-bottom: 18px;
}

.profile-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #2d3748;
  font-size: 14px;
}

.profile-form input {
  width: 100%;
  padding: 12px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.profile-form input:focus {
  border-color: #4299e1;
}

.profile-form input:disabled {
  background-color: #edf2f7;
  cursor: not-allowed;
}

.form-control-static {
  background-color: #edf2f7 !important;
  color: #718096;
}

.form-info {
  background-color: #fffaf0;
  border-left: 4px solid #ed8936;
  padding: 12px 14px;
  border-radius: 4px;
  margin-bottom: 18px;
  font-size: 13px;
  color: #7c2d12;
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

.loading-spinner {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

@media (max-width: 576px) {
  .profile-form .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .profile-card {
    padding: 30px 20px;
  }
}
</style>
