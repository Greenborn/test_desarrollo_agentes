<template>
  <div class="network-panel d-flex flex-column h-100" style="min-height: 0;">
    <div class="log-header d-flex align-items-center px-3 py-1 flex-shrink-0">
      <span class="fw-semibold small" style="color: #e6edf3;">Actividad de Red del Navegador</span>
      <span class="badge bg-secondary-subtle text-secondary ms-2" style="font-size: 0.6rem;">{{ filteredLogs.length }} / {{ networkLogs.length }} peticiones</span>
      <span v-if="!activeSessionId" class="small text-muted ms-2">(sin sesión activa)</span>
      <button
        class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto"
        style="font-size: 0.7rem;"
        :disabled="!activeSessionId || clearing"
        @click="clearLogs"
      >Limpiar</button>
    </div>
    <div class="filter-bar d-flex align-items-center gap-1 px-3 py-1 flex-shrink-0 flex-wrap">
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === 'all' && !specificCodes }"
        @click="setRangeFilter('all')"
      >All</button>
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === '2xx' && !specificCodes }"
        @click="setRangeFilter('2xx')"
      >2xx</button>
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === '3xx' && !specificCodes }"
        @click="setRangeFilter('3xx')"
      >3xx</button>
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === '4xx' && !specificCodes }"
        @click="setRangeFilter('4xx')"
      >4xx</button>
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === '5xx' && !specificCodes }"
        @click="setRangeFilter('5xx')"
      >5xx</button>
      <button
        class="filter-chip"
        :class="{ active: rangeFilter === 'err' && !specificCodes }"
        @click="setRangeFilter('err')"
      >ERR</button>
      <input
        v-model="specificCodes"
        type="text"
        class="form-control form-control-sm"
        placeholder="Códigos exactos (ej: 200,404)"
        style="width: 160px; background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.65rem; height: 22px;"
      />
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
      <div v-else-if="filteredLogs.length === 0 && !loading" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay peticiones que coincidan con el filtro.
      </div>
      <div v-else class="p-2">
        <div
          v-for="(log, i) in filteredLogs"
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
            <span v-if="log.request_size !== null || log.response_size !== null" class="size-badge flex-shrink-0" style="font-size: 0.55rem;">
              ↑{{ formatSize(log.request_size) }} ↓{{ formatSize(log.response_size) }}
            </span>
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
            <div v-if="log.request_body" class="mb-2">
              <div class="detail-label">Request Body</div>
              <pre class="detail-pre">{{ log.request_body }}</pre>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { usePlaywrightLogsStore } from '../../stores/playwrightLogs.js'
import { useChatStore } from '../../stores/chat.js'

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

    const rangeFilter = ref('all')
    const specificCodes = ref('')

    const filteredLogs = computed(() => {
      const codes = specificCodes.value.trim()
      if (codes) {
        const validCodes = codes.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        if (validCodes.length > 0) {
          return networkLogs.value.filter(log => validCodes.includes(log.status_code))
        }
      }
      if (rangeFilter.value === 'all') return networkLogs.value
      if (rangeFilter.value === 'err') return networkLogs.value.filter(log => log.status_code === null)
      const [min, max] = rangeFilter.value.split('x')[0] === '' ? [0, 99] : [
        parseInt(rangeFilter.value.split('x')[0], 10) * 100,
        (parseInt(rangeFilter.value.split('x')[0], 10) + 1) * 100
      ]
      return networkLogs.value.filter(log => log.status_code !== null && log.status_code >= min && log.status_code < max)
    })

    function setRangeFilter(range) {
      specificCodes.value = ''
      rangeFilter.value = rangeFilter.value === range ? 'all' : range
    }

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

    function formatSize(bytes) {
      if (bytes === null || bytes === undefined) return '-'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1048576).toFixed(1) + ' MB'
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
      rangeFilter,
      specificCodes,
      filteredLogs,
      setRangeFilter,
      methodClass,
      statusClass,
      isExpanded,
      toggleExpand,
      formatTime,
      formatSize,
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
.filter-bar {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.filter-chip {
  background: none;
  border: 1px solid #374151;
  color: #6b7280;
  font-size: 0.6rem;
  padding: 1px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover {
  color: #cbd5e1;
  border-color: #6b7280;
}
.filter-chip.active {
  color: #e6edf3;
  border-color: #75AADB;
  background: rgba(117, 170, 219, 0.15);
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
