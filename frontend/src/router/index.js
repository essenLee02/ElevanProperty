import { createRouter, createWebHistory } from 'vue-router'
import api from '../services/api'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import ContactView from '../views/ContactView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView
    },
    {
      path: '/contact',
      name: 'contact',
      component: ContactView
    }
  ]
})

router.afterEach((to, from) => {
  api.post('/log', {
    action: 'PAGE_VIEW',
    details: `Navigated from ${from.path} to ${to.path}`
  }).catch(err => console.error('Failed to log navigation', err));
})

export default router
