<template>
  <div class="events-panel d-flex flex-column h-100" style="min-height: 0;">
    <div class="log-header d-flex align-items-center gap-2 px-3 py-1 flex-shrink-0 flex-wrap">
      <span class="fw-semibold small" style="color: #e6edf3;">Eventos del Navegador</span>
      <span class="badge bg-secondary-subtle text-secondary ms-2" style="font-size: 0.6rem;">{{ events.length }} eventos</span>
      <span v-if="!activeSessionId" class="small text-muted ms-2">(sin sesión activa)</span>
      <div class="d-flex align-items-center gap-1 ms-auto">
        <span v-if="isRecording" class="recording-dot" title="Grabando eventos"></span>
        <button
          v-if="!isRecording"
          class="btn btn-sm py-0 px-2"
          style="font-size: 0.65rem; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);"
          :disabled="!activeSessionId || starting"
          @click="startRecording"
        >{{ starting ? 'Iniciando…' : '▶ Grabar' }}</button>
        <button
          v-if="isRecording"
          class="btn btn-sm py-0 px-2"
          style="font-size: 0.65rem; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);"
          :disabled="!activeSessionId || stopping"
          @click="stopRecording"
        >{{ stopping ? 'Deteniendo…' : '⏹ Detener' }}</button>
        <button
          class="btn btn-sm btn-outline-danger py-0 px-2"
          style="font-size: 0.7rem;"
          :disabled="!activeSessionId || clearing"
          @click="clearEvents"
        >Limpiar</button>
      </div>
    </div>
    <div class="name-bar d-flex align-items-center gap-2 px-3 py-1 flex-shrink-0">
      <span class="small text-muted" style="font-size: 0.6rem;">Nombre:</span>
      <input
        v-model="recordingName"
        class="form-control form-control-sm name-input"
        placeholder="Nombre de la grabación"
        @blur="persistName"
      />
      <span v-if="recordError" class="small text-danger" style="font-size: 0.6rem;">{{ recordError }}</span>
    </div>
    <div class="overflow-y-auto flex-grow-1" ref="containerRef">
      <div v-if="!activeSessionId" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay sesión de chat activa. Seleccione o cree una sesión para ver eventos.
      </div>
      <div v-else-if="events.length === 0 && !loading" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        No hay eventos registrados para esta sesión. Use /navegador_eventos_iniciar para comenzar la grabación.
      </div>
      <div v-else-if="loading && events.length === 0" class="d-flex align-items-center justify-content-center h-100 text-muted small">
        Cargando...
      </div>
      <div v-else class="p-2">
        <div
          v-for="(evt, i) in events"
          :key="evt.id || i"
          class="event-entry rounded"
          :class="{ expanded: expandedId === evt.id }"
        >
          <div class="event-summary d-flex align-items-start gap-2 px-2 py-1" @click="toggleExpand(evt.id)">
            <span class="event-type-badge badge flex-shrink-0 mt-1" :class="typeClass(evt.event_type)" style="font-size: 0.6rem; min-width: 44px;">{{ evt.event_type }}</span>
            <div class="min-w-0 flex-grow-1">
              <div class="event-description">{{ describeEvent(evt) }}</div>
              <div class="event-meta d-flex gap-2">
                <span v-if="evt.selector" class="event-selector">{{ evt.selector }}</span>
                <span v-if="evt.x != null && evt.y != null" class="event-coords">({{ evt.x }}, {{ evt.y }})</span>
              </div>
              <div class="event-time">{{ formatTime(evt.created_at) }}</div>
            </div>
          </div>
          <div v-if="isExpanded(evt.id)" class="event-details px-3 py-2">
            <div v-if="evt.selector" class="mb-1">
              <span class="detail-label">Selector:</span>
              <span class="detail-value"> {{ evt.selector }}</span>
            </div>
            <div v-if="evt.tag_name" class="mb-1">
              <span class="detail-label">Tag:</span>
              <span class="detail-value"> {{ evt.tag_name }}</span>
            </div>
            <div v-if="evt.text_content" class="mb-1">
              <span class="detail-label">Texto:</span>
              <span class="detail-value"> {{ evt.text_content }}</span>
            </div>
            <div v-if="evt.value != null" class="mb-1">
              <span class="detail-label">Valor:</span>
              <span class="detail-value"> {{ evt.value }}</span>
            </div>
            <div v-if="evt.key" class="mb-1">
              <span class="detail-label">Tecla:</span>
              <span class="detail-value"> {{ evt.key }} <span v-if="evt.key_code">({{ evt.key_code }})</span></span>
            </div>
            <div v-if="evt.alt_key != null || evt.ctrl_key != null || evt.shift_key != null || evt.meta_key != null" class="mb-1">
              <span class="detail-label">Modificadores:</span>
              <span class="detail-value">
                <span v-if="evt.alt_key" class="badge bg-secondary me-1" style="font-size: 0.55rem;">Alt</span>
                <span v-if="evt.ctrl_key" class="badge bg-secondary me-1" style="font-size: 0.55rem;">Ctrl</span>
                <span v-if="evt.shift_key" class="badge bg-secondary me-1" style="font-size: 0.55rem;">Shift</span>
                <span v-if="evt.meta_key" class="badge bg-secondary me-1" style="font-size: 0.55rem;">Meta</span>
                <span v-if="!evt.alt_key && !evt.ctrl_key && !evt.shift_key && !evt.meta_key">ninguno</span>
              </span>
            </div>
            <div v-if="evt.x != null && evt.y != null" class="mb-1">
              <span class="detail-label">Coordenadas:</span>
              <span class="detail-value"> ({{ evt.x }}, {{ evt.y }})</span>
            </div>
            <div v-if="evt.scroll_x != null && evt.scroll_y != null" class="mb-1">
              <span class="detail-label">Scroll:</span>
              <span class="detail-value"> x={{ evt.scroll_x }}, y={{ evt.scroll_y }}</span>
            </div>
            <div v-if="evt.target_rect" class="mb-1">
              <span class="detail-label">Rect:</span>
              <span class="detail-value"> {{ evt.target_rect }}</span>
            </div>
            <div v-if="evt.url" class="mb-1">
              <span class="detail-label">URL:</span>
              <span class="detail-value small-text"> {{ evt.url }}</span>
            </div>
            <div v-if="evt.metadata" class="mb-1">
              <span class="detail-label">Metadata:</span>
              <pre class="detail-pre">{{ formatJson(evt.metadata) }}</pre>
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
    const events = computed(() => logsStore.events)
    const loading = computed(() => logsStore.loading.events)

    const isRecording = ref(false)
    const starting = ref(false)
    const stopping = ref(false)
    const recordError = ref('')
    const recordingName = ref(logsStore.eventRecordingName || 'Nueva grabación')

    function persistName() {
      logsStore.eventRecordingName = recordingName.value
    }

    async function startRecording() {
      const sessionId = activeSessionId.value
      if (!sessionId) return
      starting.value = true
      recordError.value = ''
      try {
        const res = await fetch('/api/navegador/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            comando: 'start_event_recording',
            parametros: {},
            sessionId,
          }),
        })
        const data = await res.json()
        if (data.error) {
          recordError.value = data.error
        } else {
          isRecording.value = true
          persistName()
        }
      } catch (err) {
        console.error('Error al iniciar grabación:', err)
        recordError.value = 'Error de conexión con el servicio de navegador'
      } finally {
        starting.value = false
      }
    }

    async function stopRecording() {
      const sessionId = activeSessionId.value
      if (!sessionId) return
      stopping.value = true
      recordError.value = ''
      try {
        const res = await fetch('/api/navegador/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            comando: 'stop_event_recording',
            parametros: {},
            sessionId,
          }),
        })
        const data = await res.json()
        if (data.error) {
          recordError.value = data.error
        } else {
          isRecording.value = false
        }
      } catch (err) {
        console.error('Error al detener grabación:', err)
        recordError.value = 'Error de conexión con el servicio de navegador'
      } finally {
        stopping.value = false
      }
    }

    const EVENT_LABELS = {
      click: 'Click',
      dblclick: 'DblClick',
      input: 'Input',
      change: 'Change',
      submit: 'Submit',
      keydown: 'Tecla',
      scroll: 'Scroll',
      focus: 'Focus',
      blur: 'Blur',
    }

    function typeClass(type) {
      const map = {
        click: 'bg-primary-subtle text-primary',
        dblclick: 'bg-primary-subtle text-primary',
        input: 'bg-info-subtle text-info',
        change: 'bg-info-subtle text-info',
        submit: 'bg-warning-subtle text-warning',
        keydown: 'bg-purple-subtle text-purple',
        scroll: 'bg-secondary-subtle text-secondary',
        focus: 'bg-success-subtle text-success',
        blur: 'bg-secondary-subtle text-secondary',
      }
      return map[type] || 'bg-secondary-subtle text-secondary'
    }

    function describeEvent(evt) {
      const label = EVENT_LABELS[evt.event_type] || evt.event_type

      if (evt.event_type === 'keydown') {
        let desc = `Tecla "${evt.key}"`
        if (evt.text_content) desc += ` en "${evt.text_content}"`
        return desc
      }

      if (evt.event_type === 'scroll') {
        return `Scroll a x=${evt.scroll_x}, y=${evt.scroll_y}`
      }

      if (evt.event_type === 'input' || evt.event_type === 'change') {
        let desc = evt.text_content ? `"${evt.text_content}"` : (evt.selector || '')
        if (evt.value !== undefined && evt.value !== null) {
          const val = String(evt.value).substring(0, 80)
          desc += ` → "${val}"`
        }
        return `${label} en ${desc}`
      }

      if (evt.event_type === 'click' || evt.event_type === 'dblclick') {
        const desc = evt.text_content || evt.selector || ''
        return `${label} en "${desc}"`
      }

      if (evt.event_type === 'focus') {
        return `Focus en "${evt.text_content || evt.selector}"`
      }

      if (evt.event_type === 'blur') {
        return `Blur en "${evt.text_content || evt.selector}"`
      }

      if (evt.event_type === 'submit') {
        return `Submit formulario "${evt.text_content || evt.selector}"`
      }

      return `${label}: ${evt.text_content || evt.selector || ''}`
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

    async function clearEvents() {
      clearing.value = true
      await logsStore.clearEvents(activeSessionId.value)
      clearing.value = false
    }

    async function poll() {
      await logsStore.fetchEvents(activeSessionId.value)
    }

    watch(events, async () => {
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
      events,
      loading,
      isRecording,
      starting,
      stopping,
      recordError,
      recordingName,
      startRecording,
      stopRecording,
      persistName,
      typeClass,
      describeEvent,
      isExpanded,
      toggleExpand,
      formatTime,
      formatJson,
      clearEvents,
    }
  },
}
</script>

<style scoped>
.events-panel {
  background: #0d1117;
}
.log-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.event-entry {
  border-bottom: 1px solid #1a1a2e;
  transition: background 0.1s;
}
.event-entry:hover {
  background: rgba(117, 170, 219, 0.06);
}
.event-entry.expanded {
  background: rgba(117, 170, 219, 0.08);
}
.event-summary {
  cursor: pointer;
  min-height: 32px;
}
.event-description {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.72rem;
  color: #e6edf3;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.event-meta {
  font-size: 0.62rem;
  color: #6b7280;
  gap: 8px;
}
.event-selector {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #4a5568;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-coords {
  color: #4a5568;
  flex-shrink: 0;
}
.event-time {
  font-size: 0.6rem;
  color: #4a5568;
  margin-top: 1px;
}
.event-details {
  background: #161b22;
  border-top: 1px solid #30363d;
  font-size: 0.68rem;
  color: #cbd5e1;
}
.detail-label {
  color: #75AADB;
  font-weight: 600;
}
.detail-value {
  color: #e6edf3;
}
.small-text {
  font-size: 0.65rem;
  word-break: break-all;
}
.detail-pre {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.65rem;
  color: #e6edf3;
  background: #0d1117;
  padding: 4px 6px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
  margin: 2px 0 0;
  border: 1px solid #30363d;
}
.name-bar {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.name-input {
  max-width: 280px;
  background: #0d1117 !important;
  border-color: #374151 !important;
  color: #e0e0e0 !important;
  font-size: 0.65rem !important;
  height: 22px !important;
  padding: 0 6px !important;
}
.name-input:focus {
  border-color: #75AADB !important;
  box-shadow: 0 0 0 1px rgba(117, 170, 219, 0.2) !important;
}
.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
}
.bg-purple-subtle {
  background-color: rgba(168, 85, 247, 0.15) !important;
}
.text-purple {
  color: #a855f7 !important;
}
</style>
