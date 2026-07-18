import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import wsClient from '../services/wsClient.js'

const API = '/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref('')

  let sessionToken = null

  function getSessionToken() {
    return sessionToken
  }

  function getWorkspaceIds() {
    return user.value?.workspaceIds || []
  }

  function getPrimaryWorkspaceId() {
    const ids = getWorkspaceIds()
    return ids.length > 0 ? ids[0] : 1
  }

  function forceLogout() {
    user.value = null
    sessionToken = null
    loading.value = false
    error.value = ''
  }

  function setWorkspaceIds(ids) {
    if (user.value) {
      user.value = { ...user.value, workspaceIds: ids }
    }
  }

  const activeWorkspaceId = computed(() => {
    if (!user.value) return 1
    return getPrimaryWorkspaceId()
  })

  async function checkSession() {
    try {
      const data = await wsClient.send('checkSession', { sessionToken })
      if (data.success && data.user) {
        sessionToken = data.sessionToken
        user.value = data.user
      } else {
        user.value = null
      }
    } catch (err) {
      console.error('Error en checkSession:', err)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(username, password) {
    error.value = ''
    loading.value = true
    try {
      const data = await wsClient.send('login', { username, password })
      if (data.success) {
        sessionToken = data.sessionToken
        try {
          await fetch(`${API}/auth/apply-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionToken }),
          })
        } catch (err) {
          console.error('Error al aplicar sesión:', err)
        }
        user.value = data.user
      } else {
        error.value = data.error || 'Credenciales inválidas'
      }
    } catch (err) {
      error.value = 'Error de conexión'
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await wsClient.send('logout', { sessionToken })
    } catch (err) {
      console.error('Error en logout:', err)
    }
    sessionToken = null
    user.value = null
    loading.value = false
    document.cookie = 'session_token=; path=/; max-age=0; SameSite=Lax'
    sessionStorage.removeItem('oc_active_session_id')
    const { resetAllStores } = await import('../composables/useResetAllStores.js')
    await resetAllStores()
  }

  return { user, loading, error, getSessionToken, getWorkspaceIds, getPrimaryWorkspaceId, activeWorkspaceId, forceLogout, setWorkspaceIds, login, logout, checkSession }
})
