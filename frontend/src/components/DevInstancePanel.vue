<template>
  <div class="dev-instance-panel p-3 h-100 d-flex flex-column">
    <div class="d-flex align-items-center justify-content-between mb-2">
      <h6 class="mb-0 text-light">
        <span v-if="hasProcesses">🖥️ Instancia de Desarrollo</span>
        <span v-else class="text-muted">🖥️ Instancia de Desarrollo</span>
      </h6>
      <button v-if="hasProcesses" class="btn btn-sm btn-outline-danger" @click="detener" :disabled="deteniendo">
        {{ deteniendo ? 'Deteniendo…' : '🛑 Detener' }}
      </button>
    </div>

    <div v-if="!hasProcesses" class="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">
      <span v-if="errorMsg">{{ errorMsg }}</span>
      <span v-else>No hay instancia de desarrollo activa. Use /iniciar_instancia_dev para iniciarla.</span>
    </div>

    <div v-else class="flex-grow-1 overflow-y-auto" style="min-height: 0;">
      <div v-for="p in state.processes" :key="p.name" class="mb-2">
        <div class="d-flex align-items-center gap-2">
          <span class="status-dot" :class="p.status"></span>
          <span class="text-light fw-semibold small">{{ p.name }}</span>
          <span class="badge" :class="p.status === 'running' ? 'bg-success' : p.status === 'error' ? 'bg-danger' : 'bg-secondary'">
            {{ typeLabel(p.type) }}
          </span>
          <span class="small" :class="p.status === 'running' ? 'text-success' : p.status === 'error' ? 'text-danger' : 'text-muted'">
            {{ p.status }}
          </span>
        </div>
        <div v-if="p.status === 'running'" class="ms-4 small">
          <div v-if="portUrl(p.name)" class="text-info">{{ portUrl(p.name) }}</div>
          <div v-if="browserInfo(p.name)" class="text-secondary">🖥️ {{ browserInfo(p.name) }}</div>
        </div>
      </div>

      <div v-if="state.resolution" class="mt-2 pt-2 border-top border-secondary small text-secondary">
        🖥️ Resolución: {{ state.resolution.id }} — {{ state.resolution.width }}x{{ state.resolution.height }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue'

export default {
  setup() {
    const state = reactive({
      processes: [],
      frontendPorts: [],
      browserSessions: [],
      resolution: null,
    })

    const deteniendo = ref(false)
    const errorMsg = ref('')
    let pollTimer = null

    const hasProcesses = computed(() => state.processes.length > 0)

    function typeLabel(type) {
      return type === 'backend' ? 'nodemon' : 'npm run dev'
    }

    function portUrl(name) {
      const fe = state.frontendPorts.find(f => f.name === name)
      return fe ? `→ ${fe.url}` : ''
    }

    function browserInfo(name) {
      const bs = state.browserSessions.find(b => b.name === name)
      return bs ? `sesión: ${bs.idSession.slice(0, 8)}…` : ''
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/despliegue/estado-instancia-dev', { credentials: 'include' })
        const data = await res.json()
        if (data.success) {
          state.processes = data.processes || []
          state.frontendPorts = data.frontendPorts || []
          state.browserSessions = data.browserSessions || []
          state.resolution = data.resolution || null
          errorMsg.value = ''
        }
      } catch (err) {
        console.error('Error al obtener estado de dev instance:', err)
        errorMsg.value = 'Error al conectar con el servidor.'
      }
    }

    async function detener() {
      deteniendo.value = true
      try {
        await fetch('/api/despliegue/detener-instancia-dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
        state.processes = []
        state.frontendPorts = []
        state.browserSessions = []
        state.resolution = null
      } catch (err) {
        console.error('Error al detener instancia:', err)
      } finally {
        deteniendo.value = false
      }
    }

    onMounted(() => {
      fetchStatus()
      pollTimer = setInterval(fetchStatus, 5000)
    })

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer)
    })

    return {
      state,
      deteniendo,
      errorMsg,
      hasProcesses,
      typeLabel,
      portUrl,
      browserInfo,
      detener,
    }
  },
}
</script>

<style scoped>
.dev-instance-panel {
  background: #1a1a2e;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status-dot.running {
  background: #22c55e;
  box-shadow: 0 0 4px #22c55e;
}
.status-dot.error {
  background: #ef4444;
  box-shadow: 0 0 4px #ef4444;
}
.status-dot.stopped {
  background: #6b7280;
}
</style>
