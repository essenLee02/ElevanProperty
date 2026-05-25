import { createRouter, createWebHistory } from 'vue-router'
import api from '../services/api'
import { getCachedToken } from '../services/authApi'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import ContactView from '../views/ContactView.vue'
import Rumah123View from '../views/Rumah123View.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ProfileView from '../views/ProfileView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
    {
      path: '/contact',
      name: 'contact',
      component: ContactView,
    },
    {
      path: '/rumah123',
      name: 'rumah123',
      component: Rumah123View
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { layout: 'auth', requiresGuest: true }  // Hanya untuk user belum login
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { layout: 'auth', requiresGuest: true }  // Hanya untuk user belum login
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { layout: 'auth', requiresAuth: true }  // Hanya untuk user sudah login
    }
  ]
})

/**
 * Route Guards
 *
 * requiresAuth: true   → Hanya user yang sudah login bisa akses
 * requiresGuest: true  → Hanya user yang BELUM login bisa akses
 */
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!getCachedToken();

  // Jika route memerlukan auth (user harus login)
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
    return;
  }

  // Jika route memerlukan guest (user harus BELUM login)
  if (to.meta.requiresGuest && isAuthenticated) {
    next('/');  // Redirect logged-in user ke home (akan di-handle afterEach)
    return;
  }

  next();
});

router.afterEach((to, from) => {
  // Ambil info user yang sedang login (kalau ada) supaya backend bisa
  // menampilkan "User: nigel" di terminal log navigasi.
  let username = null;
  let userId   = null;
  try {
    const cachedUser = JSON.parse(localStorage.getItem('elevan_user_info') || 'null');
    if (cachedUser) {
      username = cachedUser.username || null;
      userId   = cachedUser.user_id  || null;
    }
  } catch (_) {
    // ignore parsing error
  }

  api.post('/log', {
    action:  'PAGE_VIEW',
    details: `Navigated from ${from.path} to ${to.path}`,
    username,
    user_id: userId
  }).catch(err => console.error('Failed to log navigation', err));
})

export default router
