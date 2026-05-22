<template>
  <section class="navbar-area navbar-nine sticky">
    <div class="container">
      <div class="row">
        <div class="col-lg-12">
          <nav class="navbar navbar-expand-lg">
            <router-link class="navbar-brand" to="/">
              <img src="/assets/images/logo.svg" alt="Logo" />
            </router-link>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNine"
              aria-controls="navbarNine" aria-expanded="false" aria-label="Toggle navigation">
              <span class="toggler-icon"></span>
              <span class="toggler-icon"></span>
              <span class="toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse sub-menu-bar" id="navbarNine">
              <ul class="navbar-nav me-auto">
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/">Home</router-link></li>
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/about">About Us</router-link></li>
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/contact">Contact</router-link></li>
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/rumah123">Rumah 123</router-link></li>
              </ul>

              <ul class="navbar-nav ms-auto auth-nav">
                <template v-if="!currentUser">
                  <li class="nav-item">
                    <router-link class="auth-link-login" to="/login">Login</router-link>
                  </li>
                  <li class="nav-item">
                    <router-link class="auth-link-register" to="/register">Register</router-link>
                  </li>
                </template>
                <template v-else>
                  <li class="nav-item">
                    <span class="navbar-user">👤 {{ currentUser.name }}</span>
                  </li>
                  <li class="nav-item">
                    <button class="auth-link-logout" @click="handleLogout">Logout</button>
                  </li>
                </template>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCachedUser, logoutUser } from '../services/authApi';
import { toast } from 'vue3-toastify';

const router = useRouter();
const currentUser = ref(null);

const refreshCurrentUser = () => {
  currentUser.value = getCachedUser();
};

const handleLogout = async () => {
  await logoutUser();
  currentUser.value = null;
  toast.info('Anda telah logout');
  router.push('/login');
};

onMounted(() => {
  refreshCurrentUser();
  // Refresh user info ketika storage berubah (mis. tab lain)
  window.addEventListener('storage', refreshCurrentUser);
});

// Refresh setiap kali route berubah (login/logout)
router.afterEach(() => {
  refreshCurrentUser();
});
</script>

<style scoped>
.auth-nav {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-left: auto;
}
.auth-link-login,
.auth-link-register,
.auth-link-logout {
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}
.auth-link-login {
  color: #667eea;
  background: transparent;
  border: 1.5px solid #667eea;
}
.auth-link-login:hover {
  background: #667eea;
  color: white;
}
.auth-link-register,
.auth-link-logout {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}
.auth-link-register:hover,
.auth-link-logout:hover {
  opacity: 0.92;
}
.navbar-user {
  color: #2d3748;
  font-weight: 500;
  font-size: 14px;
  margin-right: 8px;
}
</style>
