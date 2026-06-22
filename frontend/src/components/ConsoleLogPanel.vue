<template>
  <div class="console-panel d-flex flex-column h-100" style="min-height: 0;">
    <div class="log-header d-flex align-items-center px-3 py-1 flex-shrink-0">
      <span class="fw-semibold small" style="color: #e6edf3;">Console Log del Navegador</span>
      <span class="badge bg-secondary-subtle text-secondary ms-2" style="font-size: 0.6rem;">{{ consoleLogs.length }} logs</span>
      <span v-if="!activeSessionId" class="small text-muted ms-2">(sin sesión activa)</span>
      <button
        class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto"
        style="font-size: 0.7rem;"
        :disabled="!activeSessionId || clearing"
        @click="clearLogs"
      >Limpiar</button>
    </div>
    <div class="overflow-y-auto flex-grow-1" ref="containerRef">
      <div v-if="!activeSessionId" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay sesión de chat activa. Seleccione o cree una sesión para ver logs.
      </div>
      <div v-else-if="consoleLogs.length === 0 && !loading" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay console logs registrados para esta sesión.
      </div>
      <div v-else-if="loading && consoleLogs.length === 0" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        Cargando...
      </div>
      <div v-else class="p-2">
        <div
          v-for="(log, i) in consoleLogs"
          :key="log.id || i"
          class="console-entry d-flex align-items-start gap-2 px-2 py-1 rounded"
          :class="{ expanded: expandedId === log.id }"
          @click="toggleExpand(log.id)"
        >
          <span class="console-type-badge badge flex-shrink-0 mt-1" :class="typeClass(log.type)" style="font-size: 0.6rem;">{{ log.type }}</span>
          <div class="min-w-0 flex-grow-1">
            <div class="console-text" :class="{ truncated: !isExpanded(log.id) }">{{ log.text }}</div>
            <div v-if="isExpanded(log.id) && log.location" class="console-location">{{ log.location }}</div>
            <div class="console-time" :class="{ 'mt-1': isExpanded(log.id) }">{{ formatTime(log.created_at) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePlaywrightLogsStore } from '../stores/playwrightLogs.js'
import { useChatStore } from '../stores/chat.js'

export default {
  setup() {
    const logsStore = usePlaywrightLogsStore()
    const chatStore = useChatStore()
    const containerRef = ref(null)
    const expandedId = ref(null)
    const clearing = ref(false)
    let pollTimer = null

    const activeSessionId = computed(() => chatStore.activeSessionId)
    const consoleLogs = computed(() => logsStore.consoleLogs)
    const loading = computed(() => logsStore.loading.console)

    function typeClass(type) {
      const map = {
        log: 'bg-secondary-subtle text-secondary',
        warn: 'bg-warning-subtle text-warning',
        error: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
        debug: 'bg-purple-subtle text-purple',
      }
      return map[type] || 'bg-secondary-subtle text-secondary'
    }

    function isExpanded(id) {
      return expandedId.value === id
    }

    function toggleExpand(id) {
      expandedId.value = expandedId.value === id ? null : id
    }

    function formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    async function clearLogs() {
      clearing.value = true
      await logsStore.clearConsoleLogs(activeSessionId.value)
      clearing.value = false
    }

    async function poll() {
      await logsStore.fetchConsoleLogs(activeSessionId.value)
    }

    watch(consoleLogs, async () => {
      await nextTick()
      if (containerRef.value) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight
      }
    })

    onMounted(() => {
      poll()
      pollTimer = setInterval(poll, 3000)
    })

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer)
    })

    return {
      containerRef,
      expandedId,
      clearing,
      activeSessionId,
      consoleLogs,
      loading,
      typeClass,
      isExpanded,
      toggleExpand,
      formatTime,
      clearLogs,
    }
  },
}
</script>

<style scoped>
.console-panel {
  background: #0d1117;
}
.log-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.console-entry {
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #1a1a2e;
}
.console-entry:hover {
  background: rgba(117, 170, 219, 0.06);
}
.console-entry.expanded {
  background: rgba(117, 170, 219, 0.1);
}
.console-text {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.72rem;
  color: #e6edf3;
  line-height: 1.4;
  word-break: break-all;
  white-space: pre-wrap;
}
.console-text.truncated {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.console-location {
  font-size: 0.62rem;
  color: #6b7280;
  margin-top: 2px;
  word-break: break-all;
}
.console-time {
  font-size: 0.6rem;
  color: #4a5568;
}
.bg-purple-subtle {
  background-color: rgba(168, 85, 247, 0.15) !important;
}
.text-purple {
  color: #a855f7 !important;
}
</style>
