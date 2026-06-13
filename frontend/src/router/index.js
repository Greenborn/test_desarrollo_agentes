import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import SettingsView from '../views/SettingsView.vue'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  { path: '/', name: 'Login', component: LoginView },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/settings', name: 'Settings', component: SettingsView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth) {
    if (auth.loading) {
      await new Promise((resolve) => {
        const stop = auth.$subscribe((mutation, state) => {
          if (!state.loading) {
            stop()
            resolve()
          }
        })
      })
    }
    if (!auth.user) return next('/')
  }
  next()
})

export default router
