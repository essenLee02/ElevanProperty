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
import FacilityListView from '../views/Facility/FacilityListView.vue'
import FacilityMasterView from '../views/Facility/FacilityMasterView.vue'
import CountryListView from '../views/Country/CountryListView.vue'
import CountryMasterView from '../views/Country/CountryMasterView.vue'
import ProvinceListView from '../views/Province/ProvinceListView.vue'
import ProvinceMasterView from '../views/Province/ProvinceMasterView.vue'
import CityListView from '../views/City/CityListView.vue'
import CityMasterView from '../views/City/CityMasterView.vue'
import LocationListView from '../views/Location/LocationListView.vue'
import LocationMasterView from '../views/Location/LocationMasterView.vue'
import CustomerListView from '../views/Customer_Master/CustomerListView.vue'
import CustomerMasterView from '../views/Customer_Master/CustomerMasterView.vue'
import PropertyListView from '../views/Property/PropertyListView.vue'
import PropertyMasterView from '../views/Property/PropertyMasterView.vue'

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
    },
    // Master Data — Facility
    {
      path: '/facility',
      name: 'facility-list',
      component: FacilityListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/facility/add',
      name: 'facility-add',
      component: FacilityMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/facility/edit/:facility_id',
      name: 'facility-edit',
      component: FacilityMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — Country
    {
      path: '/country',
      name: 'country-list',
      component: CountryListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/country/add',
      name: 'country-add',
      component: CountryMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/country/edit/:country_id',
      name: 'country-edit',
      component: CountryMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — Province
    {
      path: '/province',
      name: 'province-list',
      component: ProvinceListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/province/add',
      name: 'province-add',
      component: ProvinceMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/province/edit/:province_id',
      name: 'province-edit',
      component: ProvinceMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — City
    {
      path: '/city',
      name: 'city-list',
      component: CityListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/city/add',
      name: 'city-add',
      component: CityMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/city/edit/:city_id',
      name: 'city-edit',
      component: CityMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — Customer (terisi otomatis oleh AI WhatsApp + manual agent)
    {
      path: '/customer',
      name: 'customer-list',
      component: CustomerListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/customer/add',
      name: 'customer-add',
      component: CustomerMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/customer/edit/:customer_id',
      name: 'customer-edit',
      component: CustomerMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — Location
    {
      path: '/location',
      name: 'location-list',
      component: LocationListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/location/add',
      name: 'location-add',
      component: LocationMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/location/edit/:location_id',
      name: 'location-edit',
      component: LocationMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    // Master Data — Property
    {
      path: '/property',
      name: 'property-list',
      component: PropertyListView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/property/add',
      name: 'property-add',
      component: PropertyMasterView,
      meta: { layout: 'auth', requiresAuth: true }
    },
    {
      path: '/property/edit/:property_id',
      name: 'property-edit',
      component: PropertyMasterView,
      meta: { layout: 'auth', requiresAuth: true }
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
