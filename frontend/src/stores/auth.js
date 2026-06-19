import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref('')

  function getWorkspaceId() {
    return user.value?.workspaceId || 1
  }

  function forceLogout() {
    user.value = null
    loading.value = false
    error.value = ''
  }

  function setWorkspaceId(id) {
    if (user.value) {
      user.value = { ...user.value, workspaceId: id }
    }
  }

  async function checkSession() {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: 'include' })
      const data = await res.json()
      user.value = data
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
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.success) {
        user.value = data.user
      } else {
        error.value = data.error
      }
    } catch {
      error.value = 'Error de conexión'
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Error en logout:', err)
    }
    user.value = null
    loading.value = false
  }

  return { user, loading, error, getWorkspaceId, forceLogout, setWorkspaceId, login, logout, checkSession }
})
