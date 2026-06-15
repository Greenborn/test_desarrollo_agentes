<template>
  <nav class="navbar navbar-dark bg-dark px-3">
    <span class="navbar-brand mb-0 h1">Agent Orchestrator</span>
    <div class="dropdown" v-if="user">
      <button class="btn btn-dark dropdown-toggle" data-bs-toggle="dropdown">
        {{ user.username }}
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><router-link class="dropdown-item" to="/settings">Configuración</router-link></li>
        <li><hr class="dropdown-divider" /></li>
        <li><a class="dropdown-item" href="#" @click.prevent="logout">Cerrar sesión</a></li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { storeToRefs } from 'pinia'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

export default {
  setup() {
    const auth = useAuthStore()
    const { user } = storeToRefs(auth)
    const router = useRouter()

    function logout() {
      auth.logout()
      router.push('/')
    }

    return { user, logout }
  },
}
</script>
