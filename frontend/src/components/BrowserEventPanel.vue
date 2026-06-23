<template>
  <div class="events-panel h-100 d-flex" style="min-height: 0;">
    <div class="recording-list d-flex flex-column flex-shrink-0 overflow-hidden border-end border-secondary">
      <div class="recording-list-header px-2 py-1 small fw-semibold text-secondary flex-shrink-0">Grabaciones</div>
      <div class="recording-list-body overflow-y-auto flex-grow-1 px-1">
        <div
          class="recording-item d-flex align-items-center gap-1 px-2 py-1 rounded"
          :class="{ selected: selectedRecordingId === null }"
          @click="selectRecording(null)"
        >
          <span class="recording-icon">📋</span>
          <span class="small flex-grow-1 text-truncate">No catalogado</span>
          <span class="badge bg-secondary-subtle text-secondary flex-shrink-0" style="font-size: 0.55rem;">{{ uncategorizedCount }}</span>
        </div>
        <div v-if="recordingsByGroup.withoutProject.length > 0" class="group-header px-2 py-1 small text-muted flex-shrink-0">Sin proyecto</div>
        <div
          v-for="rec in recordingsByGroup.withoutProject"
          :key="rec.id"
          class="recording-item d-flex align-items-center gap-1 px-2 py-1 rounded"
          :class="{ selected: selectedRecordingId === rec.id }"
          @click="selectRecording(rec.id)"
        >
          <span v-if="currentRecordingId === rec.id" class="recording-dot-sm" title="Grabando"></span>
          <span v-else class="recording-icon">🎬</span>
          <span class="small flex-grow-1 text-truncate">{{ rec.name }}</span>
          <span class="badge bg-secondary-subtle text-secondary flex-shrink-0" style="font-size: 0.55rem;">{{ rec.event_count }}</span>
        </div>
        <div
          v-for="(groupRecs, projectId) in recordingsByGroup.withProject"
          :key="'proj-' + projectId"
        >
          <div class="group-header px-2 py-1 small text-muted flex-shrink-0">{{ projectId }}</div>
          <div
            v-for="rec in groupRecs"
            :key="rec.id"
            class="recording-item d-flex align-items-center gap-1 px-2 py-1 rounded"
            :class="{ selected: selectedRecordingId === rec.id }"
            @click="selectRecording(rec.id)"
          >
            <span v-if="currentRecordingId === rec.id" class="recording-dot-sm" title="Grabando"></span>
            <span v-else class="recording-icon">🎬</span>
            <span class="small flex-grow-1 text-truncate">{{ rec.name }}</span>
            <span class="badge bg-secondary-subtle text-secondary flex-shrink-0" style="font-size: 0.55rem;">{{ rec.event_count }}</span>
          </div>
        </div>
      </div>
      <div class="recording-list-footer px-2 py-1 flex-shrink-0 border-top border-secondary">
        <div v-if="showNewRecordingInput" class="d-flex gap-1 align-items-center">
          <input
            v-model="newRecordingName"
            class="form-control form-control-sm"
            placeholder="Nombre de la grabación"
            style="font-size: 0.65rem; background: #0d1117; border-color: #374151; color: #e0e0e0; height: 22px;"
            @keyup.enter="confirmNewRecording"
            ref="newNameInputRef"
          />
          <button class="btn btn-sm py-0 px-1" style="font-size: 0.65rem; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);" @click="confirmNewRecording">✓</button>
          <button class="btn btn-sm py-0 px-1" style="font-size: 0.65rem; background: none; color: #6b7280; border: 1px solid #374151;" @click="cancelNewRecording">✕</button>
        </div>
        <button v-else class="btn btn-sm py-0 w-100 text-start new-recording-btn" @click="showNewRecordingInput = true; newRecordingName = ''">
          <span class="small">+ Nueva grabación</span>
        </button>
      </div>
    </div>

    <div class="recording-events d-flex flex-column flex-grow-1 overflow-hidden">
      <div class="log-header d-flex align-items-center gap-2 px-3 py-1 flex-shrink-0 flex-wrap">
        <span class="fw-semibold small" style="color: #e6edf3;">{{ selectedRecordingLabel }}</span>
        <span class="badge bg-secondary-subtle text-secondary ms-1" style="font-size: 0.6rem;">{{ displayedEvents.length }} eventos</span>
        <span v-if="!activeSessionId" class="small text-muted ms-2">(sin sesión activa)</span>
        <div class="d-flex align-items-center gap-1 ms-auto">
          <span v-if="isRecording" class="recording-dot" title="Grabando eventos"></span>
          <button
            v-if="!isRecording"
            class="btn btn-sm py-0 px-2"
            style="font-size: 0.65rem; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);"
            :disabled="!activeSessionId || !hasBrowserSession || starting"
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
          <button
            v-if="selectedRecordingId !== null"
            class="btn btn-sm btn-outline-danger py-0 px-2"
            style="font-size: 0.7rem;"
            @click="deleteRecording"
            title="Eliminar grabación"
          >🗑️</button>
        </div>
      </div>
      <div class="overflow-y-auto flex-grow-1" ref="containerRef">
        <div v-if="!activeSessionId" class="d-flex align-items-center justify-content-center h-100 text-muted small">
          No hay sesión de chat activa. Seleccione o cree una sesión para ver eventos.
        </div>
        <div v-else-if="displayedEvents.length > 0" class="p-2">
          <div
            v-for="(evt, i) in displayedEvents"
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
        <div v-else-if="!hasBrowserSession" class="d-flex flex-column align-items-center justify-content-center h-100 text-muted small" style="gap: 12px;">
          <span>No se ha iniciado ninguna instancia de navegador Playwright. Use /navegador_iniciar para iniciar una.</span>
          <button
            class="btn btn-sm py-1 px-3"
            style="font-size: 0.75rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
            :disabled="startingInstancia"
            @click="iniciarInstancia"
          >{{ startingInstancia ? 'Iniciando…' : '▶ Iniciar Instancia Desarrollo' }}</button>
        </div>
        <div v-else-if="loadingEvents" class="d-flex align-items-center justify-content-center h-100 text-muted small">
          Cargando...
        </div>
        <div v-else class="d-flex align-items-center justify-content-center h-100 text-muted small">
          No hay eventos en esta grabación. Use el botón "Grabar" para comenzar a capturar.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePlaywrightLogsStore } from '../stores/playwrightLogs.js'
import { useChatStore } from '../stores/chat.js'
import { useProjectStore } from '../stores/project.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useCommandStore } from '../stores/command.js'
import { storeToRefs } from 'pinia'

export default {
  setup() {
    const logsStore = usePlaywrightLogsStore()
    const chatStore = useChatStore()
    const projectStore = useProjectStore()
    const cmdStore = useCommandStore()
    const { find } = useCommandRegistry()
    const { selectedProject } = storeToRefs(projectStore)

    const containerRef = ref(null)
    const expandedId = ref(null)
    const clearing = ref(false)
    const hasBrowserSession = ref(false)
    const newNameInputRef = ref(null)

    const selectedRecordingId = ref(null)
    const isRecording = ref(false)
    const currentRecordingId = ref(null)
    const starting = ref(false)
    const stopping = ref(false)
    const recordError = ref('')
    const showNewRecordingInput = ref(false)
    const newRecordingName = ref('')
    const startingInstancia = ref(false)

    let pollTimer = null
    let statusTimer = null
    let recordingPollTimer = null

    const activeSessionId = computed(() => chatStore.activeSessionId)
    const loadingEvents = computed(() => logsStore.loading.recordingEvents)

    const currentProjectId = computed(() => {
      const session = chatStore.sessions.find(s => s.id === activeSessionId.value)
      if (session?.proyecto_id) return session.proyecto_id
      if (selectedProject.value?.id) return selectedProject.value.id
      return null
    })

    const recordingsByGroup = computed(() => {
      const withProject = {}
      const withoutProject = []
      for (const r of logsStore.recordings) {
        if (r.project_id) {
          if (!withProject[r.project_id]) withProject[r.project_id] = []
          withProject[r.project_id].push(r)
        } else {
          withoutProject.push(r)
        }
      }
      return { withoutProject, withProject }
    })

    const selectedRecordingLabel = computed(() => {
      if (selectedRecordingId.value === null) return 'No catalogado'
      const rec = logsStore.recordings.find(r => r.id === selectedRecordingId.value)
      return rec ? rec.name : 'No catalogado'
    })

    const displayedEvents = computed(() => logsStore.recordingEvents)

    const uncategorizedCount = computed(() => logsStore.uncategorizedCount)

    function selectRecording(id) {
      selectedRecordingId.value = id
    }

    async function fetchRecordingEvents() {
      await logsStore.fetchRecordingEvents(selectedRecordingId.value)
    }

    async function fetchRecordings() {
      await logsStore.fetchRecordings(currentProjectId.value)
    }

    async function startRecording() {
      if (selectedRecordingId.value === null) {
        showNewRecordingInput.value = true
        newRecordingName.value = ''
        await nextTick()
        if (newNameInputRef.value) newNameInputRef.value.focus()
        return
      }
      await doStartRecording(selectedRecordingId.value)
    }

    async function confirmNewRecording() {
      const name = newRecordingName.value.trim()
      if (!name) return
      showNewRecordingInput.value = false
      const sessionId = activeSessionId.value
      if (!sessionId) return
      if (!currentProjectId.value) {
        alert('No hay un proyecto activo. Seleccione o cree un proyecto antes de crear una grabación.')
        newRecordingName.value = ''
        return
      }
      starting.value = true
      try {
        const rec = await logsStore.createEventRecording({
          name,
          chatSessionId: sessionId,
          projectId: currentProjectId.value,
        })
        await fetchRecordings()
        selectedRecordingId.value = rec.id
        await doStartRecording(rec.id)
      } catch (err) {
        console.error('Error al crear grabación:', err)
        recordError.value = err.message
      } finally {
        starting.value = false
      }
    }

    function cancelNewRecording() {
      showNewRecordingInput.value = false
      newRecordingName.value = ''
    }

    async function iniciarInstancia() {
      if (!activeSessionId.value) return
      startingInstancia.value = true
      try {
        const cmd = find('/despliegue_iniciar_instancia')
        await chatStore.runCommand('/despliegue_iniciar_instancia', async (loadingIdx) => {
          if (cmd) {
            return cmd.execute([], { cmdStore, chatStore, loadingIdx })
          }
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: '/despliegue_iniciar_instancia' }),
          })
          const data = await res.json()
          if (data.success) return data.result
          throw new Error(data.result || 'Error al ejecutar comando')
        })
      } catch (err) {
        console.error('Error al iniciar instancia:', err)
      } finally {
        startingInstancia.value = false
      }
    }

    async function doStartRecording(recordingId) {
      const sessionId = activeSessionId.value
      if (!sessionId) return
      starting.value = true
      try {
        const res = await fetch('/api/navegador/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            comando: 'start_event_recording',
            parametros: { recording_id: recordingId },
            sessionId,
          }),
        })
        const data = await res.json()
        if (data.error) {
          recordError.value = data.error
        } else {
          isRecording.value = true
          currentRecordingId.value = recordingId
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
          currentRecordingId.value = null
        }
      } catch (err) {
        console.error('Error al detener grabación:', err)
        recordError.value = 'Error de conexión con el servicio de navegador'
      } finally {
        stopping.value = false
      }
    }

    async function clearEvents() {
      clearing.value = true
      const query = selectedRecordingId.value === null ? 'recording_id=none' : `recording_id=${selectedRecordingId.value}`
      try {
        await fetch(`/api/playwright-logs/events?${query}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        logsStore.recordingEvents = []
      } catch (err) {
        console.error('Error al limpiar eventos:', err.message)
      } finally {
        clearing.value = false
      }
    }

    async function deleteRecording() {
      if (selectedRecordingId.value === null) return
      if (!confirm('¿Eliminar esta grabación? Los eventos pasarán a "No catalogado".')) return
      try {
        await logsStore.deleteRecording(selectedRecordingId.value)
        selectedRecordingId.value = null
      } catch (err) {
        console.error('Error al eliminar grabación:', err)
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

    async function fetchStatus() {
      try {
        const res = await fetch('/api/navegador/status', { credentials: 'include' })
        const data = await res.json()
        hasBrowserSession.value = !!data.hasActiveSession
      } catch (err) {
        console.error('Error al verificar estado del navegador:', err.message)
        hasBrowserSession.value = false
      }
    }

    async function pollRecordings() {
      await fetchRecordings()
      await fetchRecordingEvents()
    }

    watch(selectedRecordingId, async () => {
      await fetchRecordingEvents()
    })

    watch(() => logsStore.recordingEvents, async () => {
      await nextTick()
      if (containerRef.value) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight
      }
    })

    onMounted(async () => {
      fetchStatus()
      await fetchRecordings()
      await fetchRecordingEvents()
      statusTimer = setInterval(fetchStatus, 5000)
      recordingPollTimer = setInterval(fetchRecordings, 5000)
      pollTimer = setInterval(fetchRecordingEvents, 3000)
    })

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer)
      if (statusTimer) clearInterval(statusTimer)
      if (recordingPollTimer) clearInterval(recordingPollTimer)
    })

    return {
      containerRef,
      expandedId,
      clearing,
      hasBrowserSession,
      newNameInputRef,
      selectedRecordingId,
      isRecording,
      currentRecordingId,
      starting,
      stopping,
      recordError,
      showNewRecordingInput,
      newRecordingName,
      activeSessionId,
      loadingEvents,
      recordingsByGroup,
      selectedRecordingLabel,
      displayedEvents,
      uncategorizedCount,
      selectRecording,
      startRecording,
      confirmNewRecording,
      cancelNewRecording,
      startingInstancia,
      iniciarInstancia,
      stopRecording,
      clearEvents,
      deleteRecording,
      typeClass,
      describeEvent,
      isExpanded,
      toggleExpand,
      formatTime,
      formatJson,
    }
  },
}
</script>

<style scoped>
.events-panel {
  background: #0d1117;
}
.recording-list {
  width: 220px;
  min-width: 180px;
  max-width: 280px;
  background: #161b22;
}
.recording-list-header {
  border-bottom: 1px solid #30363d;
}
.recording-list-body {
  scrollbar-width: thin;
}
.recording-item {
  cursor: pointer;
  transition: background 0.1s;
  min-height: 26px;
}
.recording-item:hover {
  background: rgba(117, 170, 219, 0.06);
}
.recording-item.selected {
  background: rgba(117, 170, 219, 0.18);
}
.recording-icon {
  font-size: 0.7rem;
  flex-shrink: 0;
}
.recording-dot-sm {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: pulse 1.5s ease-in-out infinite;
}
.group-header {
  border-top: 1px solid #30363d;
  margin-top: 2px;
  font-size: 0.6rem;
}
.recording-list-footer {
  background: #161b22;
}
.new-recording-btn {
  background: none;
  border: none;
  color: #75AADB;
  cursor: pointer;
  transition: color 0.15s;
}
.new-recording-btn:hover {
  color: #a0c4e8;
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
