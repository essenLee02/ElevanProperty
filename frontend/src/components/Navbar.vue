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
              <!-- Menu untuk user yang BELUM login -->
              <template v-if="!currentUser">
                <ul class="navbar-nav me-auto">
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/">Home</router-link></li>
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/about">About Us</router-link></li>
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/contact">Contact</router-link></li>
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/rumah123">Rumah 123</router-link></li>
                </ul>

                <ul class="navbar-nav ms-auto auth-nav">
                  <li class="nav-item">
                    <router-link class="auth-link-login" to="/login">Login</router-link>
                  </li>
                  <li class="nav-item">
                    <router-link class="auth-link-register" to="/register">Register</router-link>
                  </li>
                </ul>
              </template>

              <!-- Menu untuk user yang SUDAH login -->
              <template v-else>
                <ul class="navbar-nav me-auto">
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/rumah123">Rumah 123</router-link></li>
                  <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/facility">Master Fasilitas</router-link></li>
                </ul>

                <ul class="navbar-nav ms-auto auth-nav">
                  <li class="nav-item">
                    <span class="navbar-user">{{ currentUser.name }}</span>
                  </li>

                  <!-- Settings Dropdown -->
                  <li class="nav-item dropdown-container">
                    <button class="settings-btn" @click="toggleSettingsMenu" title="Pengaturan">
                      ⚙️
                    </button>

                    <div v-if="showSettingsMenu" class="settings-dropdown">
                      <div class="dropdown-header">
                        <span class="dropdown-title">Pengaturan</span>
                      </div>

                      <router-link
                        to="/profile"
                        class="dropdown-menu-item profile-item"
                        @click="showSettingsMenu = false"
                      >
                        <span class="item-icon">👤</span>
                        <span class="item-text">Profil Saya</span>
                      </router-link>

                      <router-link
                        to="/facility"
                        class="dropdown-menu-item profile-item"
                        @click="showSettingsMenu = false"
                      >
                        <span class="item-icon">🏷️</span>
                        <span class="item-text">Master Fasilitas</span>
                      </router-link>

                      <div class="dropdown-divider"></div>

                      <button
                        class="dropdown-menu-item logout-item"
                        @click="handleLogout"
                      >
                        <span class="item-icon">🚪</span>
                        <span class="item-text">Logout</span>
                      </button>
                    </div>
                  </li>
                </ul>
              </template>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCachedUser, logoutUser } from '../services/authApi';
import { toast } from 'vue3-toastify';

const router = useRouter();
const currentUser = ref(null);
const showSettingsMenu = ref(false);

const refreshCurrentUser = () => {
  currentUser.value = getCachedUser();
};

const toggleSettingsMenu = () => {
  showSettingsMenu.value = !showSettingsMenu.value;
};

const closeSettingsMenu = (event) => {
  // Tutup menu jika klik di luar dropdown
  const dropdown = document.querySelector('.dropdown-container');
  if (dropdown && !dropdown.contains(event.target)) {
    showSettingsMenu.value = false;
  }
};

const handleLogout = async () => {
  showSettingsMenu.value = false;
  await logoutUser();
  currentUser.value = null;
  toast.info('Anda telah logout');
  router.push('/login');
};

onMounted(() => {
  refreshCurrentUser();
  // Refresh user info ketika storage berubah (mis. tab lain)
  window.addEventListener('storage', refreshCurrentUser);
  // Close menu ketika klik di luar
  document.addEventListener('click', closeSettingsMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeSettingsMenu);
});

// Refresh setiap kali route berubah (login/logout)
router.afterEach(() => {
  refreshCurrentUser();
  showSettingsMenu.value = false;
});
</script>

<style scoped>
.auth-nav {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-left: auto;
}

.auth-link-login {
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1.5px solid #667eea;
  color: #667eea;
  background: transparent;
}

.auth-link-login:hover {
  background: #667eea;
  color: white;
}

.auth-link-register {
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.auth-link-register:hover {
  opacity: 0.92;
}

.navbar-user {
  color: white;
  font-weight: 500;
  font-size: 14px;
  margin-right: 12px;
}

/* Settings Dropdown */
.dropdown-container {
  position: relative;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  backdrop-filter: blur(10px);
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.settings-btn:active {
  transform: scale(0.98);
}

.settings-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: white;
  border: 1px solid #e8e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  min-width: 220px;
  z-index: 2000;
  overflow: visible;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f0f8 100%);
  border-bottom: 1px solid #e8e8f0;
}

.dropdown-title {
  display: block;
  font-weight: 600;
  color: #2d3748;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dropdown-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  text-align: left;
  color: #1a202c;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
}

.dropdown-menu-item:hover {
  background-color: #f7fafc;
  padding-left: 20px;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  width: 24px;
  height: 24px;
}

.item-text {
  flex: 1;
  color: #1a202c;
}

.profile-item {
  color: #1a202c;
}

.profile-item:hover {
  color: #667eea;
  background-color: #f0f4ff;
}

.dropdown-divider {
  height: 1px;
  background-color: #e8e8f0;
  margin: 0;
}

.logout-item {
  color: #1a202c;
  font-weight: 600;
}

.logout-item:hover {
  background-color: #fff5f5;
  color: #e53e3e;
  padding-left: 20px;
}

@media (max-width: 768px) {
  .dropdown-container {
    position: relative;
  }

  .settings-btn {
    width: 44px;
    height: 44px;
    font-size: 20px;
    padding: 0;
  }

  .settings-dropdown {
    position: fixed;
    top: auto;
    right: 12px;
    left: auto;
    bottom: auto;
    max-width: calc(100vw - 24px);
    min-width: 200px;
    z-index: 2000;
  }

  .dropdown-menu-item {
    padding: 14px 16px;
    font-size: 15px;
  }

  .dropdown-menu-item:hover {
    padding-left: 20px;
  }

  .item-icon {
    font-size: 20px;
    width: 28px;
    height: 28px;
  }
}
</style>
