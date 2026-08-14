<template>
  <div class="interfaz-remota-container d-flex flex-column flex-grow-1 overflow-auto p-3">
    <h6 class="text-light mb-3">Interfaz Remota</h6>

    <div v-if="loading" class="text-secondary">
      <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      Consultando estado de conexión...
    </div>

    <div v-else class="card border-0" style="background: #1e2b1e;">
      <div class="card-body p-3">

        <div class="d-flex align-items-center mb-2">
          <span class="badge me-2" :class="loginBadgeClass">{{ loginStatusLabel }}</span>
          <span class="text-secondary small">Login servicio de gestión interna</span>
        </div>
        <p class="mb-1" :class="loginMessageClass">{{ loginStatusMessage }}</p>
        <div v-if="login.checkedAt" class="text-secondary small mb-3">
          Verificado: {{ login.checkedAt }}
        </div>

        <div class="d-flex align-items-center mb-2">
          <span class="badge me-2" :class="wsBadgeClass">{{ wsStatusLabel }}</span>
          <span class="text-secondary small">WebSocket</span>
        </div>
        <p class="mb-1" :class="wsMessageClass">{{ wsStatusMessage }}</p>
        <div v-if="login.url" class="text-secondary small">
          URL: <code>{{ login.url }}</code>
        </div>
        <div v-if="ws.url" class="text-secondary small">
          WS: <code>{{ ws.url }}</code>
        </div>
        <div v-if="ws.connectedAt" class="text-secondary small">
          Conectado desde: {{ ws.connectedAt }}
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'InterfazRemotaTab',
  setup() {
    const loading = ref(true)
    const state = ref({ login: {}, ws: {} })

    async function loadStatus() {
      loading.value = true
      try {
        const res = await fetch('/api/interfaz-remota/status', { credentials: 'include' })
        const data = await res.json()
        state.value = { login: data.login || {}, ws: data.ws || {} }
      } catch (err) {
        console.log('InterfazRemotaTab: error al consultar estado de conexión a gestión interna:', err.message)
        state.value = { login: { attempted: true, success: false, configured: false, message: 'No se pudo consultar el estado de conexión.' }, ws: {} }
      } finally {
        loading.value = false
      }
    }

    onMounted(loadStatus)

    const login = computed(() => state.value.login)
    const ws = computed(() => state.value.ws)

    const loginStatusLabel = computed(() => {
      const s = login.value
      if (!s.attempted) return 'Sin intentar'
      if (s.success) return 'Conectado'
      if (!s.configured) return 'No configurado'
      return 'Error de conexión'
    })

    const loginBadgeClass = computed(() => {
      const s = login.value
      if (!s.attempted) return 'bg-secondary'
      if (s.success) return 'bg-success'
      return 'bg-danger'
    })

    const loginStatusMessage = computed(() => {
      const s = login.value
      if (s.message) return s.message
      if (s.success) return 'Login exitoso en el servicio de gestión interna.'
      return 'No se pudo realizar el login en el servicio de gestión interna.'
    })

    const loginMessageClass = computed(() => (login.value.success ? 'text-success' : 'text-danger'))

    const wsStatusLabel = computed(() => {
      const s = ws.value
      if (!s.attempted) return 'Sin intentar'
      if (s.connected) return 'Conectado'
      return 'Desconectado'
    })

    const wsBadgeClass = computed(() => {
      const s = ws.value
      if (!s.attempted) return 'bg-secondary'
      if (s.connected) return 'bg-success'
      return 'bg-danger'
    })

    const wsStatusMessage = computed(() => {
      const s = ws.value
      if (s.message) return s.message
      if (s.connected) return 'Conexión WebSocket activa con el servicio de gestión interna.'
      return 'No hay conexión WebSocket activa.'
    })

    const wsMessageClass = computed(() => (ws.value.connected ? 'text-success' : 'text-danger'))

    return {
      loading, login, ws,
      loginStatusLabel, loginBadgeClass, loginStatusMessage, loginMessageClass,
      wsStatusLabel, wsBadgeClass, wsStatusMessage, wsMessageClass,
    }
  },
}
</script>

<style scoped>
.interfaz-remota-container {
  min-height: 0;
}
</style>
