<template>
  <div class="interfaz-remota-container d-flex flex-column flex-grow-1 overflow-auto p-3">
    <h6 class="text-light mb-3 d-flex align-items-center justify-content-between">
      <span>Interfaz Remota</span>
      <button
        class="btn btn-sm"
        :class="enabled ? 'btn-success' : 'btn-outline-secondary'"
        @click="toggleEnabled"
        :disabled="toggling"
      >
        <span v-if="toggling" class="spinner-border spinner-border-sm me-1" role="status"></span>
        <i :class="enabled ? 'bi bi-toggle-on' : 'bi bi-toggle-off'" class="me-1"></i>
        {{ enabled ? 'Habilitada' : 'Deshabilitada' }}
      </button>
    </h6>

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
        <div v-if="!login.success && login.requestLog" class="text-danger small mb-1">
          <i class="bi bi-server me-1"></i>
          Respuesta del servidor: {{ login.requestLog.method }} {{ login.requestLog.statusCode }}
          <code class="ms-1">{{ login.requestLog.url }}</code>
        </div>
        <div v-if="login.checkedAt" class="text-secondary small mb-3">
          Verificado: {{ login.checkedAt }}
        </div>

        <div class="d-flex align-items-center mb-2">
          <span class="badge me-2" :class="wsBadgeClass">{{ wsStatusLabel }}</span>
          <span class="text-secondary small">WebSocket</span>
        </div>
        <p class="mb-1" :class="wsMessageClass">{{ wsStatusMessage }}</p>
        <div v-if="ws.error" class="text-danger small mb-1">
          <i class="bi bi-exclamation-triangle me-1"></i>
          Motivo: {{ ws.error }}
        </div>
        <div v-if="login.url" class="text-secondary small">
          URL: <code>{{ login.url }}</code>
        </div>
        <div v-if="ws.url" class="text-secondary small">
          WS: <code>{{ ws.url }}</code>
        </div>
        <div v-if="ws.connectedAt" class="text-secondary small">
          Conectado desde: {{ ws.connectedAt }}
        </div>
        <div v-if="ws.announce" class="text-secondary small">
          Anunciado en gestión interna ({{ ws.announce.cantidad }} sistema(s) conectado(s))
        </div>

      </div>
    </div>

    <div class="card border-0 mt-3" style="background: #1e2b1e;">
      <div class="card-body p-3">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-light">Testing</span>
          <button class="btn btn-sm btn-primary" @click="runChatSessionsTest" :disabled="testing">
            <span v-if="testing" class="spinner-border spinner-border-sm me-1" role="status"></span>
            <i class="bi bi-chat-square-text me-1"></i>
            Probar pseudoendpoint de sesiones de chat
          </button>
        </div>

        <div v-if="testResult">
          <div class="d-flex align-items-center mb-2">
            <span class="badge me-2" :class="testResult.success ? 'bg-success' : 'bg-danger'">
              {{ testResult.success ? 'Éxito' : 'Error' }}
            </span>
            <span class="text-secondary small">
              {{ testResult.checkedAt ? 'Probado: ' + testResult.checkedAt : '' }}
            </span>
          </div>

          <div v-if="testResult.success" class="text-secondary small mb-2">
            <template v-if="testResult.data">
              {{ testResult.data.activas.length }} activa(s), {{ testResult.data.archivadas.length }} archivada(s)
            </template>
          </div>

          <div v-else class="text-danger small mb-2">
            {{ testResult.error || 'Error al probar el pseudoendpoint.' }}
          </div>

          <button
            class="btn btn-sm btn-outline-secondary mb-2"
            @click="showTestDetail = !showTestDetail"
          >
            <i :class="['bi', 'me-1', showTestDetail ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
            {{ showTestDetail ? 'Ocultar' : 'Ver' }} detalle JSON
          </button>
          <pre v-if="showTestDetail" class="small mb-0" style="max-height: 300px; overflow: auto; background: #142114; border-radius: 4px; padding: 8px; color: #9fd9a0;">{{ JSON.stringify(testResult, null, 2) }}</pre>
        </div>
      </div>
    </div>
    <div class="card border-0 mt-3" style="background: #1e2b1e;">
      <div class="card-body p-3">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <span class="text-light">Log de mensajes io del WebSocket</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge" :class="sseConnected ? 'bg-success' : 'bg-danger'">
              {{ sseConnected ? 'En vivo' : 'Desconectado' }}
            </span>
            <button class="btn btn-sm btn-outline-secondary" @click="toggleIoLogDetail">
              <i :class="['bi', 'me-1', showIoLogDetail ? 'bi-chevron-up' : 'bi-chevron-down']"></i>
              {{ showIoLogDetail ? 'Ocultar' : 'Ver' }} log
            </button>
            <button class="btn btn-sm btn-outline-secondary" @click="clearIoLog" :disabled="ioLog.length === 0">
              <i class="bi bi-trash me-1"></i>
              Limpiar
            </button>
            <button class="btn btn-sm btn-outline-secondary" @click="copyIoLog" :disabled="ioLog.length === 0">
              <i class="bi me-1" :class="copied ? 'bi-check-lg' : 'bi-clipboard'"></i>
              {{ copied ? 'Copiado' : 'Copiar' }}
            </button>
          </div>
        </div>

        <div v-if="!showIoLogDetail && ioLog.length > 0" class="text-secondary small">
          {{ ioLog.length }} mensaje(s) registrado(s). Pulsa "Ver log" para detallarlos.
        </div>

        <div v-if="showIoLogDetail" class="io-log-box">
          <div v-if="ioLog.length === 0" class="text-secondary small p-2">
            Sin mensajes io registrados todavía.
          </div>
          <div
            v-for="entry in ioLog"
            :key="entry.id"
            class="io-log-entry"
          >
            <div class="d-flex align-items-center gap-2">
              <span class="badge" :class="entry.direction === 'in' ? 'bg-info' : 'bg-warning'">
                {{ entry.direction === 'in' ? 'IN' : 'OUT' }}
              </span>
              <code class="small">{{ entry.event }}</code>
              <span class="text-secondary small ms-auto">{{ formatTs(entry.ts) }}</span>
            </div>
            <pre class="io-log-payload mb-0">{{ JSON.stringify(entry.data, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { settingGet, settingSet } from '../../../services/settingService.js'
import { copyToClipboard } from '../../../utils/clipboard.js'

const IO_LOG_MAX = 200

const ENABLED_KEY = 'interfaz_remota_enabled'

export default {
  name: 'InterfazRemotaTab',
  setup() {
    const loading = ref(true)
    const toggling = ref(false)
    const testing = ref(false)
    const testResult = ref(null)
    const showTestDetail = ref(false)
    const state = ref({ login: {}, ws: {} })
    const enabled = ref(true)
    const ioLog = ref([])
    const showIoLogDetail = ref(false)
    const sseConnected = ref(false)
    const copied = ref(false)
    let copyTimer = null
    let eventSource = null

    async function loadStatus() {
      loading.value = true
      try {
        const res = await fetch('/api/interfaz-remota/status', { credentials: 'include' })
        const data = await res.json()
        state.value = { login: data.login || {}, ws: data.ws || {} }
        if (Array.isArray(data.ioLog) && data.ioLog.length > 0) {
          ioLog.value = data.ioLog.slice(-IO_LOG_MAX)
        }
        if (typeof data.enabled === 'boolean') enabled.value = data.enabled
      } catch (err) {
        console.log('InterfazRemotaTab: error al consultar estado de conexión a gestión interna:', err.message)
        state.value = { login: { attempted: true, success: false, configured: false, message: 'No se pudo consultar el estado de conexión.' }, ws: {} }
      } finally {
        loading.value = false
      }
    }

    async function loadEnabledPref() {
      try {
        const result = await settingGet(ENABLED_KEY)
        if (result.value !== null && result.value !== undefined) {
          enabled.value = result.value === '1' || result.value === 'true'
        }
      } catch (err) {
        console.log('InterfazRemotaTab: error al leer preferencia de conexión:', err.message)
      }
    }

    async function persistEnabledPref(value) {
      try {
        await settingSet(ENABLED_KEY, value ? '1' : '0')
      } catch (err) {
        console.log('InterfazRemotaTab: error al guardar preferencia de conexión:', err.message)
      }
    }

    async function toggleEnabled() {
      toggling.value = true
      try {
        if (enabled.value) {
          const res = await fetch('/api/interfaz-remota/disable', {
            method: 'POST',
            credentials: 'include',
          })
          const data = await res.json()
          state.value = { login: data.login || {}, ws: data.ws || {} }
          enabled.value = false
        } else {
          const res = await fetch('/api/interfaz-remota/enable', {
            method: 'POST',
            credentials: 'include',
          })
          const data = await res.json()
          state.value = { login: data.login || {}, ws: data.ws || {} }
          enabled.value = true
        }
        await persistEnabledPref(enabled.value)
      } catch (err) {
        console.log('InterfazRemotaTab: error al cambiar estado de conexión:', err.message)
      } finally {
        toggling.value = false
      }
    }

    async function runChatSessionsTest() {
      testing.value = true
      showTestDetail.value = false
      try {
        const res = await fetch('/api/interfaz-remota/test/chat-sessions', {
          method: 'POST',
          credentials: 'include',
        })
        const data = await res.json()
        testResult.value = data
      } catch (err) {
        console.log('InterfazRemotaTab: error al probar pseudoendpoint de sesiones de chat:', err.message)
        testResult.value = {
          success: false,
          error: 'No se pudo invocar el pseudoendpoint de sesiones de chat.',
          checkedAt: new Date().toISOString(),
        }
      } finally {
        testing.value = false
      }
    }

    function setupEventSource() {
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      eventSource = new EventSource('/api/interfaz-remota/events')
      eventSource.onopen = () => {
        sseConnected.value = true
      }
      eventSource.onmessage = (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch (err) {
          console.log('InterfazRemotaTab: error al parsear mensaje SSE:', err.message)
          return
        }
        if (msg.type === 'snapshot') {
          if (Array.isArray(msg.ioLog) && msg.ioLog.length > 0) {
            ioLog.value = msg.ioLog.slice(-IO_LOG_MAX)
          }
          return
        }
        if (msg.type === 'io' && msg.entry) {
          ioLog.value.push(msg.entry)
          if (ioLog.value.length > IO_LOG_MAX) {
            ioLog.value = ioLog.value.slice(ioLog.value.length - IO_LOG_MAX)
          }
        }
      }
      eventSource.onerror = (event) => {
        sseConnected.value = false
        console.log('InterfazRemotaTab: error de conexión SSE del log io:', event.type)
      }
    }

    function toggleIoLogDetail() {
      showIoLogDetail.value = !showIoLogDetail.value
    }

    function clearIoLog() {
      ioLog.value = []
    }

    function copyIoLog() {
      const text = ioLog.value
        .map((entry) => {
          const dir = entry.direction === 'in' ? 'IN ' : 'OUT'
          return `${formatTs(entry.ts)} [${dir}] ${entry.event}\n${JSON.stringify(entry.data, null, 2)}`
        })
        .join('\n\n')
      copyToClipboard(text)
        .then(() => {
          copied.value = true
          if (copyTimer) clearTimeout(copyTimer)
          copyTimer = setTimeout(() => {
            copied.value = false
            copyTimer = null
          }, 1500)
        })
        .catch((err) => {
          console.log('InterfazRemotaTab: error al copiar el log io:', err.message)
        })
    }

    function formatTs(ts) {
      if (!ts) return ''
      try {
        return new Date(ts).toLocaleTimeString('es-ES', { hour12: false })
      } catch (err) {
        console.log('InterfazRemotaTab: error al formatear timestamp:', err.message)
        return String(ts)
      }
    }

    onMounted(async () => {
      await loadEnabledPref()
      await loadStatus()
      setupEventSource()
    })

    onUnmounted(() => {
      if (copyTimer) {
        clearTimeout(copyTimer)
        copyTimer = null
      }
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    })

    const login = computed(() => state.value.login)
    const ws = computed(() => state.value.ws)

    const loginStatusLabel = computed(() => {
      const s = login.value
      if (!enabled.value) return 'Deshabilitada'
      if (!s.attempted) return 'Sin intentar'
      if (s.success) return 'Conectado'
      if (!s.configured) return 'No configurado'
      return 'Error de conexión'
    })

    const loginBadgeClass = computed(() => {
      const s = login.value
      if (!enabled.value) return 'bg-secondary'
      if (!s.attempted) return 'bg-secondary'
      if (s.success) return 'bg-success'
      return 'bg-danger'
    })

    const loginStatusMessage = computed(() => {
      const s = login.value
      if (!enabled.value) return 'La conexión está deshabilitada. Habilítala para conectarse.'
      if (s.message) return s.message
      if (s.success) return 'Login exitoso en el servicio de gestión interna.'
      return 'No se pudo realizar el login en el servicio de gestión interna.'
    })

    const loginMessageClass = computed(() => {
      if (!enabled.value) return 'text-secondary'
      return login.value.success ? 'text-success' : 'text-danger'
    })

    const wsStatusLabel = computed(() => {
      const s = ws.value
      if (!enabled.value) return 'Deshabilitado'
      if (!s.attempted) return 'Sin intentar'
      if (s.connected) return 'Conectado'
      return 'Desconectado'
    })

    const wsBadgeClass = computed(() => {
      const s = ws.value
      if (!enabled.value) return 'bg-secondary'
      if (!s.attempted) return 'bg-secondary'
      if (s.connected) return 'bg-success'
      return 'bg-danger'
    })

    const wsStatusMessage = computed(() => {
      const s = ws.value
      if (!enabled.value) return 'WebSocket deshabilitado.'
      if (s.connected) return 'Conexión WebSocket activa con el servicio de gestión interna.'
      if (s.message) return s.message
      return s.error
        ? `No hay conexión WebSocket activa. Motivo: ${s.error}`
        : 'No hay conexión WebSocket activa.'
    })

    const wsMessageClass = computed(() => {
      if (!enabled.value) return 'text-secondary'
      return ws.value.connected ? 'text-success' : 'text-danger'
    })

    return {
      loading, toggling, enabled, login, ws,
      toggleEnabled, runChatSessionsTest,
      testing, testResult, showTestDetail,
      loginStatusLabel, loginBadgeClass, loginStatusMessage, loginMessageClass,
      wsStatusLabel, wsBadgeClass, wsStatusMessage, wsMessageClass,
      ioLog, showIoLogDetail, sseConnected, copied,
      toggleIoLogDetail, clearIoLog, copyIoLog, formatTs,
    }
  },
}
</script>

<style scoped>
.interfaz-remota-container {
  min-height: 0;
}

.io-log-box {
  max-height: 320px;
  overflow: auto;
  background: #142114;
  border-radius: 4px;
  padding: 8px;
  border: 1px solid #2b442b;
}

.io-log-entry {
  border-bottom: 1px solid #2b442b;
  padding: 6px 2px;
}

.io-log-entry:last-child {
  border-bottom: none;
}

.io-log-payload {
  white-space: pre-wrap;
  word-break: break-word;
  color: #9fd9a0;
  font-size: 0.72rem;
  margin-top: 4px;
}
</style>
