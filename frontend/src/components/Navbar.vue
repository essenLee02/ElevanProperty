<template>
  <header class="navbar-elevan" :class="{ scrolled: isScrolled }">
    <div class="container">

      <!-- Brand -->
      <router-link class="navbar-brand-elevan" to="/" @click="closeDropdown">
        <div class="brand-logo-mark">E</div>
        <span class="brand-name">Elevan <span>Property</span></span>
      </router-link>

      <!-- Desktop Nav — Guest -->
      <nav class="navbar-links d-none d-lg-flex" v-if="!currentUser">
        <router-link class="nav-link-elevan" active-class="active" to="/">Home</router-link>
        <router-link class="nav-link-elevan" active-class="active" to="/about">About</router-link>
        <router-link class="nav-link-elevan" active-class="active" to="/contact">Contact</router-link>
        <router-link class="nav-link-elevan" active-class="active" to="/rumah123">Rumah123</router-link>
      </nav>

      <!-- Desktop Nav — Authenticated -->
      <nav class="navbar-links d-none d-lg-flex" v-else>
        <router-link class="nav-link-elevan" active-class="active" to="/rumah123">Rumah123</router-link>
        <router-link class="nav-link-elevan" active-class="active" to="/facility">Fasilitas</router-link>
      </nav>

      <!-- Actions -->
      <div class="navbar-actions">

        <!-- Guest: Login / Register -->
        <template v-if="!currentUser">
          <router-link to="/login" class="btn btn-outline-white btn-sm d-none d-md-inline-flex">
            Masuk
          </router-link>
          <router-link to="/register" class="btn btn-gold btn-sm">
            Daftar
          </router-link>
        </template>

        <!-- Authenticated: User chip + Settings -->
        <template v-else>
          <div class="navbar-user-chip d-none d-md-flex">
            <div class="user-avatar-mini">{{ userInitial }}</div>
            <span>{{ currentUser.name }}</span>
          </div>

          <!-- Settings Dropdown -->
          <div class="nav-dropdown" ref="dropdownRef">
            <button
              class="btn btn-outline-white btn-sm"
              @click="toggleDropdown"
              :aria-expanded="showDropdown"
              aria-label="Menu pengaturan"
            >
              <i class="fa-solid fa-gear"></i>
            </button>

            <div v-if="showDropdown" class="nav-dropdown-menu" role="menu">
              <div class="dropdown-header-menu">
                <span>Pengaturan</span>
              </div>

              <router-link
                to="/profile"
                class="dropdown-item-elevan"
                @click="closeDropdown"
                role="menuitem"
              >
                <i class="fa-regular fa-circle-user item-icon"></i>
                <span>Profil Saya</span>
              </router-link>

              <router-link
                to="/facility"
                class="dropdown-item-elevan"
                @click="closeDropdown"
                role="menuitem"
              >
                <i class="fa-solid fa-tags item-icon"></i>
                <span>Master Fasilitas</span>
              </router-link>

              <div class="dropdown-divider-item"></div>

              <button
                class="dropdown-item-elevan danger"
                @click="handleLogout"
                role="menuitem"
              >
                <i class="fa-solid fa-right-from-bracket item-icon"></i>
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </template>

        <!-- Mobile Hamburger -->
        <button
          class="btn btn-outline-white btn-sm d-lg-none"
          @click="toggleMobileMenu"
          :aria-expanded="showMobileMenu"
          aria-label="Toggle navigation"
        >
          <i :class="showMobileMenu ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'"></i>
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-if="showMobileMenu" class="mobile-menu">
      <div class="container">
        <template v-if="!currentUser">
          <router-link class="mobile-nav-link" to="/"        @click="closeMobileMenu">Home</router-link>
          <router-link class="mobile-nav-link" to="/about"   @click="closeMobileMenu">About</router-link>
          <router-link class="mobile-nav-link" to="/contact" @click="closeMobileMenu">Contact</router-link>
          <router-link class="mobile-nav-link" to="/rumah123"@click="closeMobileMenu">Rumah123</router-link>
          <div class="mobile-nav-divider"></div>
          <router-link class="mobile-nav-link" to="/login"   @click="closeMobileMenu">Masuk</router-link>
          <router-link class="mobile-nav-link accent" to="/register" @click="closeMobileMenu">Daftar</router-link>
        </template>
        <template v-else>
          <div class="mobile-nav-user">
            <div class="user-avatar-mini">{{ userInitial }}</div>
            <div>
              <div style="font-weight:600;color:#fff;font-size:.9rem;">{{ currentUser.name }}</div>
              <div style="font-size:.75rem;color:rgba(255,255,255,.55);">Agent</div>
            </div>
          </div>
          <router-link class="mobile-nav-link" to="/rumah123" @click="closeMobileMenu">Rumah123</router-link>
          <router-link class="mobile-nav-link" to="/facility" @click="closeMobileMenu">Master Fasilitas</router-link>
          <router-link class="mobile-nav-link" to="/profile"  @click="closeMobileMenu">Profil Saya</router-link>
          <div class="mobile-nav-divider"></div>
          <button class="mobile-nav-link danger" @click="handleLogout">Keluar</button>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getCachedUser, logoutUser } from '../services/authApi';
import { toast } from 'vue3-toastify';

/* ── State ─────────────────────────────────────────────── */
const router        = useRouter();
const currentUser   = ref(null);
const showDropdown  = ref(false);
const showMobileMenu= ref(false);
const isScrolled    = ref(false);
const dropdownRef   = ref(null);

/* ── Computed ──────────────────────────────────────────── */
/** First letter of user's name for avatar */
const userInitial = computed(() => {
  const name = currentUser.value?.name || '';
  return name.charAt(0).toUpperCase();
});

/* ── Methods ───────────────────────────────────────────── */
const refreshCurrentUser = () => { currentUser.value = getCachedUser(); };

const toggleDropdown  = () => { showDropdown.value  = !showDropdown.value; };
const closeDropdown   = () => { showDropdown.value  = false; };
const toggleMobileMenu= () => { showMobileMenu.value= !showMobileMenu.value; };
const closeMobileMenu = () => { showMobileMenu.value= false; };

/** Close settings dropdown when clicking outside */
const handleOutsideClick = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    closeDropdown();
  }
};

/** Track scroll position to apply shadow */
const handleScroll = () => { isScrolled.value = window.scrollY > 20; };

const handleLogout = async () => {
  closeDropdown();
  closeMobileMenu();
  await logoutUser();
  currentUser.value = null;
  toast.info('Anda telah keluar');
  router.push('/login');
};

/* ── Lifecycle ─────────────────────────────────────────── */
onMounted(() => {
  refreshCurrentUser();
  window.addEventListener('storage',    refreshCurrentUser);
  document.addEventListener('click',    handleOutsideClick);
  window.addEventListener('scroll',     handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('storage', refreshCurrentUser);
  document.removeEventListener('click', handleOutsideClick);
  window.removeEventListener('scroll',  handleScroll);
});

router.afterEach(() => {
  refreshCurrentUser();
  closeDropdown();
  closeMobileMenu();
});
</script>

<style scoped>
/* Mobile Menu */
.mobile-menu {
  border-top: 1px solid rgba(255,255,255,.08);
  background: rgba(22,33,60,.98);
  backdrop-filter: blur(12px);
  padding: 12px 0 20px;
  animation: slideDown 0.18s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mobile-nav-user {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0; margin-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.mobile-nav-link {
  display: block; width: 100%;
  padding: 11px 4px;
  font-size: 0.9rem; font-weight: 500;
  color: rgba(255,255,255,.8);
  text-decoration: none;
  border: none; background: none; cursor: pointer;
  text-align: left;
  border-bottom: 1px solid rgba(255,255,255,.05);
  transition: color 0.18s;
}
.mobile-nav-link:hover, .mobile-nav-link.router-link-active { color: #fff; }
.mobile-nav-link.accent { color: var(--gold); }
.mobile-nav-link.danger { color: #fc8181; }
.mobile-nav-divider { height: 1px; background: rgba(255,255,255,.08); margin: 8px 0; }
</style>
