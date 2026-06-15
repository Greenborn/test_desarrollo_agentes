<template>
  <div class="d-flex align-items-center justify-content-center vh-100 bg-dark">
    <div class="card shadow bg-dark text-light" style="width: 360px;">
      <div class="card-body p-4">
        <h4 class="card-title text-center mb-4 text-light">Agent Orchestrator</h4>
        <form @submit.prevent="handleLogin">
          <div class="mb-3">
            <label class="form-label text-light">Usuario</label>
            <input v-model="username" class="form-control bg-dark text-light border-secondary" autocomplete="username" required />
          </div>
          <div class="mb-3">
            <label class="form-label text-light">Contraseña</label>
            <input v-model="password" type="password" class="form-control bg-dark text-light border-secondary" autocomplete="current-password" required />
          </div>
          <div v-if="auth.error" class="alert alert-danger py-2 small">{{ auth.error }}</div>
          <button type="submit" class="btn btn-primary w-100">Iniciar sesión</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

export default {
  setup() {
    const auth = useAuthStore()
    const router = useRouter()
    const username = ref('')
    const password = ref('')

    onMounted(() => {
      if (auth.user) router.push('/dashboard')
    })

    watch(() => auth.user, (val) => {
      if (val) router.push('/dashboard')
    })

    function handleLogin() {
      auth.login(username.value, password.value)
    }

    return { auth, username, password, handleLogin }
  },
}
</script>
