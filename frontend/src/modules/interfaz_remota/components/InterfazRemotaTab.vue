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
          <span class="badge me-2" :class="badgeClass">{{ statusLabel }}</span>
          <span class="text-secondary small">Conexión con servicio de gestión interna</span>
        </div>

        <p class="mb-1" :class="messageClass">{{ statusMessage }}</p>

        <div v-if="state.url" class="text-secondary small">
          URL: <code>{{ state.url }}</code>
        </div>
        <div v-if="state.checkedAt" class="text-secondary small">
          Verificado: {{ state.checkedAt }}
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
    const state = ref({})

    async function loadStatus() {
      loading.value = true
      try {
        const res = await fetch('/api/interfaz-remota/status', { credentials: 'include' })
        const data = await res.json()
        state.value = data || {}
      } catch (err) {
        console.log('InterfazRemotaTab: error al consultar estado de login a gestión interna:', err.message)
        state.value = { attempted: true, success: false, configured: false, message: 'No se pudo consultar el estado de conexión.' }
      } finally {
        loading.value = false
      }
    }

    onMounted(loadStatus)

    const statusLabel = computed(() => {
      if (!state.value.attempted) return 'Sin intentar'
      if (state.value.success) return 'Conectado'
      if (!state.value.configured) return 'No configurado'
      return 'Error de conexión'
    })

    const badgeClass = computed(() => {
      if (!state.value.attempted) return 'bg-secondary'
      if (state.value.success) return 'bg-success'
      return 'bg-danger'
    })

    const statusMessage = computed(() => {
      if (state.value.message) return state.value.message
      if (state.value.success) return 'Login exitoso en el servicio de gestión interna.'
      return 'No se pudo realizar el login en el servicio de gestión interna.'
    })

    const messageClass = computed(() => (state.value.success ? 'text-success' : 'text-danger'))

    return { loading, state, statusLabel, badgeClass, statusMessage, messageClass }
  },
}
</script>

<style scoped>
.interfaz-remota-container {
  min-height: 0;
}
</style>
