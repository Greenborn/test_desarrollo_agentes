<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <!-- Tab bar -->
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'instancias' }"
        @click="activeTab = 'instancias'"
      >
        Instancias de Desarrollo
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'repositorio' }"
        @click="activeTab = 'repositorio'"
      >
        Repositorio
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'tickets' }"
        @click="activeTab = 'tickets'"
      >
        Tickets
      </button>
      <button
        v-if="activeTab === 'instancias' && hasProcesses"
        class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto"
        @click="detener"
        :disabled="deteniendo"
        style="font-size: 0.75rem;"
      >
        {{ deteniendo ? 'Deteniendo…' : '🛑 Detener' }}
      </button>
    </div>

    <!-- Tab: Instancias de Desarrollo -->
    <template v-if="activeTab === 'instancias'">
      <div v-if="!hasProcesses" class="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">
        <span v-if="errorMsg">{{ errorMsg }}</span>
        <span v-else>No hay instancia de desarrollo activa. Use /despliegue_iniciar_instancia para iniciarla.</span>
      </div>
      <div v-else class="d-flex flex-grow-1" style="min-height: 0;">
        <div class="left-panel d-flex flex-column flex-shrink-0 overflow-y-auto px-2 py-1">
          <button
            v-for="p in state.processes"
            :key="p.name"
            class="process-btn d-flex align-items-center gap-1 w-100 text-start px-2 py-1 mb-1"
            :class="{ selected: selectedProcess === p.name }"
            @click="toggleProcess(p.name)"
          >
            <span class="status-dot" :class="p.status"></span>
            <span class="small fw-semibold" :class="p.status === 'running' ? 'text-light' : 'text-muted'">{{ p.name }}</span>
            <span class="badge ms-auto" :class="p.status === 'running' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'" style="font-size: 0.6rem;">{{ typeLabel(p.type) }}</span>
          </button>

          <div v-if="state.resolution" class="mt-auto pt-1 small text-secondary px-2" style="font-size: 0.65rem;">
            🖥️ {{ state.resolution.id }} — {{ state.resolution.width }}x{{ state.resolution.height }}
          </div>
        </div>

        <div class="right-panel d-flex flex-column flex-grow-1 overflow-hidden border-start border-secondary">
          <div class="log-header d-flex align-items-center px-2 py-1 small text-secondary">
            <span v-if="selectedProcess">[{{ selectedProcess }}]</span>
            <span v-else>[todos los procesos]</span>
            <span class="ms-auto text-muted" style="font-size: 0.6rem;">{{ displayedLines }} líneas</span>
          </div>
          <pre ref="logContainerRef" class="log-output flex-grow-1 mb-0 p-2">{{ displayText }}</pre>
        </div>
      </div>
    </template>

    <!-- Tab: Repositorio -->
    <template v-if="activeTab === 'repositorio'">
      <RepoView class="flex-grow-1" />
    </template>

    <!-- Tab: Tickets -->
    <template v-if="activeTab === 'tickets'">
      <TicketPanel class="flex-grow-1" />
    </template>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import RepoView from './RepoView.vue'
import TicketPanel from './TicketPanel.vue'

export default {
  components: { RepoView, TicketPanel },
  setup() {
    const state = reactive({
      processes: [],
      frontendPorts: [],
      browserSessions: [],
      resolution: null,
    })

    const activeTab = ref('instancias')
    const selectedProcess = ref(null)
    const logsMap = reactive({})
    const deteniendo = ref(false)
    const errorMsg = ref('')
    const logContainerRef = ref(null)
    let statusTimer = null
    let logsTimer = null

    const hasProcesses = computed(() => state.processes.length > 0)

    const processNames = computed(() => state.processes.map(p => p.name))

    function typeLabel(type) {
      return type === 'backend' ? 'nodemon' : 'npm run dev'
    }

    const displayText = computed(() => {
      const names = processNames.value
      if (names.length === 0) return ''

      if (selectedProcess.value) {
        const lines = logsMap[selectedProcess.value]
        return lines ? lines.join('\n') : ''
      }

      const combined = []
      for (const name of names) {
        const lines = logsMap[name]
        if (lines && lines.length) {
          combined.push(`── ${name} ──`)
          combined.push(...lines)
        }
      }
      return combined.join('\n')
    })

    const displayedLines = computed(() => {
      if (!displayText.value) return 0
      return displayText.value.split('\n').length
    })

    function toggleProcess(name) {
      selectedProcess.value = selectedProcess.value === name ? null : name
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

          const currentNames = new Set(processNames.value)
          for (const key of Object.keys(logsMap)) {
            if (!currentNames.has(key)) delete logsMap[key]
          }
        }
      } catch (err) {
        console.error('Error al obtener estado de dev instance:', err)
        errorMsg.value = 'Error al conectar con el servidor.'
      }
    }

    async function fetchLogs() {
      const names = processNames.value
      for (const name of names) {
        try {
          const res = await fetch(`/api/despliegue/logs?name=${encodeURIComponent(name)}`, { credentials: 'include' })
          const data = await res.json()
          if (data.success) {
            logsMap[name] = data.logs || []
          }
        } catch (err) {
          console.error(`Error al obtener logs para ${name}:`, err)
        }
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
        for (const key of Object.keys(logsMap)) delete logsMap[key]
      } catch (err) {
        console.error('Error al detener instancia:', err)
      } finally {
        deteniendo.value = false
      }
    }

    watch(displayText, async () => {
      await nextTick()
      if (logContainerRef.value) {
        logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
      }
    })

    onMounted(() => {
      fetchStatus().then(fetchLogs)
      statusTimer = setInterval(fetchStatus, 5000)
      logsTimer = setInterval(fetchLogs, 1500)
    })

    onBeforeUnmount(() => {
      if (statusTimer) clearInterval(statusTimer)
      if (logsTimer) clearInterval(logsTimer)
    })

    return {
      state,
      activeTab,
      selectedProcess,
      deteniendo,
      errorMsg,
      logContainerRef,
      hasProcesses,
      typeLabel,
      displayText,
      displayedLines,
      toggleProcess,
      detener,
    }
  },
}
</script>

<style scoped>
.dev-instance-panel {
  background: #1a1a2e;
}
.tab-bar {
  border-bottom: 1px solid #374151;
}
.tab-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: #cbd5e1;
}
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
.left-panel {
  width: auto;
  min-width: 120px;
  max-width: 200px;
  background: #16213e;
}
.process-btn {
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #cbd5e1;
  font-size: 0.75rem;
  transition: background 0.15s;
}
.process-btn:hover {
  background: rgba(117, 170, 219, 0.1);
}
.process-btn.selected {
  background: rgba(117, 170, 219, 0.18);
  color: #75AADB;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status-dot.running {
  background: #22c55e;
  box-shadow: 0 0 3px #22c55e;
}
.status-dot.error {
  background: #ef4444;
  box-shadow: 0 0 3px #ef4444;
}
.status-dot.stopped {
  background: #6b7280;
}
.right-panel {
  background: #0d1117;
}
.log-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  font-size: 0.7rem;
}
.log-output {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #e6edf3;
  background: transparent;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
