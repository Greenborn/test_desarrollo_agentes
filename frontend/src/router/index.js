import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import { useAuthStore } from '../stores/auth.js'
import wsClient from '../services/wsClient.js'

const routes = [
  { path: '/', name: 'Login', component: LoginView },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()

  if (auth.loading) {
    if (to.meta.requiresAuth) {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const userData = await res.json()
        if (userData && userData.id) {
          auth.user = userData
          auth.loading = false
          try {
            await wsClient.connect()
            await auth.checkSession()
          } catch (wsErr) {
            console.error('Error conectando WebSocket:', wsErr.message)
          }
        } else {
          auth.loading = false
          return next('/')
        }
      } catch (err) {
        console.error('Error al verificar sesión:', err)
        auth.loading = false
        return next('/')
      }
    } else {
      auth.loading = false
    }
  }

  if (to.meta.requiresAuth && !auth.user) {
    return next('/')
  }
  next()
})

export default router
