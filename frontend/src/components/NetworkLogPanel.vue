<template>
  <div class="network-panel d-flex flex-column h-100" style="min-height: 0;">
    <div class="log-header d-flex align-items-center px-3 py-1 flex-shrink-0">
      <span class="fw-semibold small" style="color: #e6edf3;">Actividad de Red del Navegador</span>
      <span class="badge bg-secondary-subtle text-secondary ms-2" style="font-size: 0.6rem;">{{ networkLogs.length }} peticiones</span>
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
      <div v-else-if="networkLogs.length === 0 && !loading" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay actividad de red registrada para esta sesión.
      </div>
      <div v-else-if="loading && networkLogs.length === 0" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        Cargando...
      </div>
      <div v-else class="p-2">
        <div
          v-for="(log, i) in networkLogs"
          :key="log.id || i"
          class="network-entry rounded"
          :class="{ expanded: expandedId === log.id, failed: log.status_code === null }"
        >
          <div class="network-summary d-flex align-items-center gap-2 px-2 py-1" @click="toggleExpand(log.id)">
            <span class="method-badge badge flex-shrink-0" :class="methodClass(log.method)" style="font-size: 0.6rem; min-width: 40px;">{{ log.method }}</span>
            <span v-if="log.status_code !== null" class="status-badge badge flex-shrink-0" :class="statusClass(log.status_code)" style="font-size: 0.6rem; min-width: 32px;">{{ log.status_code }}</span>
            <span v-else class="status-badge badge bg-danger-subtle text-danger flex-shrink-0" style="font-size: 0.6rem; min-width: 32px;">ERR</span>
            <span class="network-url text-truncate flex-grow-1">{{ log.url }}</span>
            <span class="resource-type-badge badge flex-shrink-0" style="font-size: 0.55rem;">{{ log.resource_type }}</span>
            <span class="network-time flex-shrink-0">{{ formatTime(log.created_at) }}</span>
          </div>
          <div v-if="isExpanded(log.id)" class="network-details px-3 py-2">
            <div v-if="log.request_headers" class="mb-2">
              <div class="detail-label">Request Headers</div>
              <pre class="detail-pre">{{ formatJson(log.request_headers) }}</pre>
            </div>
            <div v-if="log.response_headers" class="mb-2">
              <div class="detail-label">Response Headers</div>
              <pre class="detail-pre">{{ formatJson(log.response_headers) }}</pre>
            </div>
            <div v-if="log.response_body" class="mb-2">
              <div class="detail-label">Response Body</div>
              <pre class="detail-pre">{{ log.response_body }}</pre>
            </div>
            <div v-if="log.error" class="mb-2">
              <div class="detail-label text-danger">Error</div>
              <pre class="detail-pre text-danger">{{ log.error }}</pre>
            </div>
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
    const networkLogs = computed(() => logsStore.networkLogs)
    const loading = computed(() => logsStore.loading.network)

    function methodClass(method) {
      const map = {
        GET: 'bg-success-subtle text-success',
        POST: 'bg-primary-subtle text-primary',
        PUT: 'bg-warning-subtle text-warning',
        PATCH: 'bg-warning-subtle text-warning',
        DELETE: 'bg-danger-subtle text-danger',
        HEAD: 'bg-secondary-subtle text-secondary',
        OPTIONS: 'bg-secondary-subtle text-secondary',
      }
      return map[method] || 'bg-secondary-subtle text-secondary'
    }

    function statusClass(code) {
      if (code >= 200 && code < 300) return 'bg-success-subtle text-success'
      if (code >= 300 && code < 400) return 'bg-info-subtle text-info'
      if (code >= 400 && code < 500) return 'bg-warning-subtle text-warning'
      if (code >= 500) return 'bg-danger-subtle text-danger'
      return 'bg-secondary-subtle text-secondary'
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

    function formatJson(str) {
      if (!str) return ''
      try {
        return JSON.stringify(JSON.parse(str), null, 2)
      } catch {
        return str
      }
    }

    async function clearLogs() {
      clearing.value = true
      await logsStore.clearNetworkLogs(activeSessionId.value)
      clearing.value = false
    }

    async function poll() {
      await logsStore.fetchNetworkLogs(activeSessionId.value)
    }

    watch(networkLogs, async () => {
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
      networkLogs,
      loading,
      methodClass,
      statusClass,
      isExpanded,
      toggleExpand,
      formatTime,
      formatJson,
      clearLogs,
    }
  },
}
</script>

<style scoped>
.network-panel {
  background: #0d1117;
}
.log-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.network-entry {
  border-bottom: 1px solid #1a1a2e;
  transition: background 0.1s;
}
.network-entry:hover {
  background: rgba(117, 170, 219, 0.06);
}
.network-entry.expanded {
  background: rgba(117, 170, 219, 0.08);
}
.network-entry.failed {
  border-left: 2px solid #ef4444;
}
.network-summary {
  cursor: pointer;
  min-height: 28px;
}
.network-url {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.72rem;
  color: #cbd5e1;
  direction: rtl;
  text-align: left;
}
.network-time {
  font-size: 0.6rem;
  color: #4a5568;
}
.resource-type-badge {
  background: #2d3748 !important;
  color: #9ca3af !important;
}
.network-details {
  background: #161b22;
  border-top: 1px solid #30363d;
}
.detail-label {
  font-size: 0.65rem;
  color: #75AADB;
  font-weight: 600;
  margin-bottom: 2px;
}
.detail-pre {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.68rem;
  color: #e6edf3;
  background: #0d1117;
  padding: 6px 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  border: 1px solid #30363d;
}
</style>
