import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSocket } from '../composables/useSocket.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const error = ref('')
  const socket = useSocket()

  socket.on('auth:me', (data) => {
    user.value = data
    loading.value = false
  })

  socket.on('auth:session', ({ token }) => {
    if (token) {
      localStorage.setItem('session_token', token)
    } else {
      localStorage.removeItem('session_token')
    }
  })

  socket.on('auth:login_res', (data) => {
    if (data.success) {
      user.value = data.user
      error.value = ''
    } else {
      error.value = data.error
    }
  })

  function login(username, password) {
    error.value = ''
    socket.emit('auth:login', { username, password })
  }

  function logout() {
    localStorage.removeItem('session_token')
    socket.emit('auth:logout')
    user.value = null
  }

  return { user, loading, error, login, logout }
})
