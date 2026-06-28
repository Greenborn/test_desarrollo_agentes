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
    try {
      await wsClient.connect()
    } catch (err) {
      console.error('Error al conectar WebSocket:', err)
    }
    await auth.checkSession()
  }
  if (to.meta.requiresAuth && !auth.user) {
    return next('/')
  }
  next()
})

export default router
