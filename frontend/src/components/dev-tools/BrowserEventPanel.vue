<template>
  <div class="events-panel h-100 d-flex" style="min-height: 0;">
    <div class="recording-list d-flex flex-column flex-shrink-0 border-end border-secondary" :style="{ width: uiStore.recordingListWidth + 'px' }">
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
        >
          <span v-if="currentRecordingId === rec.id" class="recording-dot-sm" title="Grabando"></span>
          <span v-else class="recording-icon">🎬</span>
          <template v-if="editingRecordingId === rec.id">
            <input v-model="editName" class="form-control form-control-sm flex-grow-1" style="font-size: 0.65rem; background: #0d1117; border-color: #374151; color: #e0e0e0; height: 22px;" @keyup.enter="saveRename(rec)" @keyup.escape="cancelRename" @blur="cancelRename" autofocus />
          </template>
          <template v-else>
            <span class="small flex-grow-1 text-truncate" @click="selectRecording(rec.id)">{{ rec.name }}</span>
          </template>
          <span class="badge bg-secondary-subtle text-secondary flex-shrink-0" style="font-size: 0.55rem;">{{ rec.event_count }}</span>
          <button v-if="editingRecordingId !== rec.id && isRecording && currentRecordingId === rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="stopRecording()" title="Detener">⏹</button>
          <button v-else-if="editingRecordingId !== rec.id && !isRecording && !replaying" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="startRecordingOn(rec)" title="Grabar">▶</button>
          <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="deleteRecording(rec)" title="Eliminar">🗑️</button>
          <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="startRename(rec)" title="Renombrar">✏️</button>
          <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="cloneRecording(rec)" title="Clonar">📋</button>
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
          >
            <span v-if="currentRecordingId === rec.id" class="recording-dot-sm" title="Grabando"></span>
            <span v-else class="recording-icon">🎬</span>
            <template v-if="editingRecordingId === rec.id">
              <input v-model="editName" class="form-control form-control-sm flex-grow-1" style="font-size: 0.65rem; background: #0d1117; border-color: #374151; color: #e0e0e0; height: 22px;" @keyup.enter="saveRename(rec)" @keyup.escape="cancelRename" @blur="cancelRename" autofocus />
            </template>
            <template v-else>
              <span class="small flex-grow-1 text-truncate" @click="selectRecording(rec.id)">{{ rec.name }}</span>
            </template>
            <span class="badge bg-secondary-subtle text-secondary flex-shrink-0" style="font-size: 0.55rem;">{{ rec.event_count }}</span>
            <button v-if="editingRecordingId !== rec.id && isRecording && currentRecordingId === rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="stopRecording()" title="Detener">⏹</button>
            <button v-else-if="editingRecordingId !== rec.id && !isRecording && !replaying" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="startRecordingOn(rec)" title="Grabar">▶</button>
            <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="deleteRecording(rec)" title="Eliminar">🗑️</button>
            <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="startRename(rec)" title="Renombrar">✏️</button>
            <button v-if="editingRecordingId !== rec.id" class="btn btn-link btn-sm p-0 text-secondary" style="text-decoration: none; font-size: 0.6rem; line-height: 1;" @click.stop="cloneRecording(rec)" title="Clonar">📋</button>
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
      <div class="recording-list-resize-handle" @mousedown.prevent="onRecordingListResizeStart">
        <div class="recording-list-resize-handle-bar"></div>
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
            class="btn btn-sm py-0 px-2"
            style="font-size: 0.65rem; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);"
            :disabled="!hasBrowserSession || isRecording || displayedEvents.length === 0"
            @click="replayRecording"
          >▶ Reproducir</button>
          <button
            class="btn btn-sm py-0 px-2"
            style="font-size: 0.65rem; background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3);"
            :disabled="!hasBrowserSession"
            @click="toggleQueryForm"
          >🔍 Consultar</button>
          <template v-if="replaying">
            <button
              class="btn btn-sm py-0 px-2"
              style="font-size: 0.65rem; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);"
              @click="cancelReplay"
            >⏹ Detener</button>
            <span class="small text-muted">Paso {{ replayProgress.current }}/{{ replayProgress.total }}</span>
          </template>
        </div>
      </div>
      <div v-if="showQueryForm" class="query-form px-3 py-2 border-bottom border-secondary flex-shrink-0">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <input
            v-model="querySelector"
            class="form-control form-control-sm"
            placeholder="Selector CSS (ej: #username, .mensaje, input[name='email'])"
            style="font-size: 0.7rem; background: #0d1117; border-color: #374151; color: #e0e0e0; min-width: 220px; flex: 1;"
            @keyup.enter="executeQuery"
          />
          <select
            v-model="queryExtractType"
            class="form-select form-select-sm"
            style="font-size: 0.7rem; background: #0d1117; border-color: #374151; color: #e0e0e0; width: auto;"
          >
            <option value="value">Valor</option>
            <option value="text">Texto</option>
            <option value="html">HTML</option>
            <option value="attribute">Atributo</option>
            <option value="checked">Checked</option>
            <option value="exists">Existe</option>
            <option value="count">Cantidad</option>
          </select>
          <input
            v-if="queryExtractType === 'attribute'"
            v-model="queryAttributeName"
            class="form-control form-control-sm"
            placeholder="Nombre del atributo"
            style="font-size: 0.7rem; background: #0d1117; border-color: #374151; color: #e0e0e0; width: 120px;"
            @keyup.enter="executeQuery"
          />
          <button
            class="btn btn-sm py-0 px-2"
            style="font-size: 0.7rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
            :disabled="!querySelector || queryExecuting"
            @click="executeQuery"
          >{{ queryExecuting ? 'Consultando...' : '▶ Ejecutar' }}</button>
          <button
            class="btn btn-sm py-0 px-2"
            style="font-size: 0.65rem; background: none; color: #6b7280; border: 1px solid #374151;"
            @click="showQueryForm = false"
          >✕</button>
        </div>
        <div v-if="queryResult !== null" class="query-result mt-2 p-2 rounded" style="background: #161b22; border: 1px solid #30363d;">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="small text-success fw-semibold">Resultado:</span>
            <span class="small query-result-value">{{ formatQueryResult(queryResult) }}</span>
            <span v-if="queryResult.found === false" class="small text-warning">(elemento no encontrado)</span>
          </div>
          <div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
            <label class="small text-muted d-flex align-items-center gap-1" style="cursor: pointer;">
              <input type="checkbox" v-model="querySaveToRecording" class="form-check-input m-0" style="width: 12px; height: 12px;" />
              💾 Guardar como paso en grabación
            </label>
            <button
              class="btn btn-sm py-0 px-2"
              style="font-size: 0.65rem; background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);"
              :disabled="querySaving"
              @click="sendQueryResultToChat"
            >💬 Enviar al chat</button>
          </div>
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
            @contextmenu.prevent="showContextMenu($event, evt)"
          >
            <div class="event-summary d-flex align-items-start gap-2 px-2 py-1" @click="toggleExpand(evt.id)">
              <button
                class="btn btn-sm p-0 event-delete-btn flex-shrink-0 mt-1"
                :disabled="deletingEventId === evt.id"
                @click.stop="deleteSingleEvent(evt)"
                title="Eliminar evento"
              >🗑️</button>
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
    <div
      v-if="contextMenu.show"
      class="context-menu-backdrop"
      @mousedown="closeContextMenu"
      @contextmenu.prevent
    ></div>
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="deleteContextEvent">Eliminar evento</div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePlaywrightLogsStore } from '../../stores/playwrightLogs.js'
import { useChatStore } from '../../stores/chat.js'
import { useProjectStore } from '../../stores/project.js'
import { useBrowserStore } from '../../stores/browser.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'
import { useCommandStore } from '../../stores/command.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useUiStore } from '../../stores/ui.js'
import { storeToRefs } from 'pinia'

export default {
  setup() {
    const logsStore = usePlaywrightLogsStore()
    const chatStore = useChatStore()
    const projectStore = useProjectStore()
    const browserStore = useBrowserStore()
    const cmdStore = useCommandStore()
    const settingsStore = useSettingsStore()
    const uiStore = useUiStore()
    const { find } = useCommandRegistry()
    const { selectedProject } = storeToRefs(projectStore)
    const { hasBrowserSession, isRecording, currentRecordingId, selectedRecordingId, starting, stopping } = storeToRefs(browserStore)

    const containerRef = ref(null)
    const expandedId = ref(null)
    const clearing = ref(false)
    const newNameInputRef = ref(null)
    const contextMenu = ref({ show: false, x: 0, y: 0, event: null })
    const deletingEventId = ref(null)

    const recordError = ref('')
    const showNewRecordingInput = ref(false)
    const newRecordingName = ref('')
    const startingInstancia = ref(false)
    const editingRecordingId = ref(null)
    const editName = ref('')
    const replaying = ref(false)
    const replayProgress = ref({ current: 0, total: 0 })
    const replayCancelled = ref(false)

    const showQueryForm = ref(false)
    const querySelector = ref('')
    const queryExtractType = ref('value')
    const queryAttributeName = ref('')
    const queryExecuting = ref(false)
    const queryResult = ref(null)
    const querySaveToRecording = ref(false)
    const querySaving = ref(false)

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

    function showContextMenu(e, evt) {
      contextMenu.value = { show: true, x: e.clientX, y: e.clientY, event: evt }
    }

    function closeContextMenu() {
      contextMenu.value.show = false
    }

    async function deleteEventById(id) {
      if (!id) return
      deletingEventId.value = id
      try {
        const res = await fetch(`/api/playwright-logs/events/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (res.ok) {
          logsStore.recordingEvents = logsStore.recordingEvents.filter(e => e.id !== id)
        }
      } catch (err) {
        console.error('Error al eliminar evento:', err.message)
      } finally {
        deletingEventId.value = null
      }
    }

    async function deleteSingleEvent(evt) {
      await deleteEventById(evt.id)
    }

    async function deleteContextEvent() {
      const evt = contextMenu.value.event
      if (!evt || !evt.id) return
      closeContextMenu()
      await deleteEventById(evt.id)
    }

    function onDocumentClick(e) {
      if (contextMenu.value.show && e.button !== 2) closeContextMenu()
    }

    function selectRecording(id) {
      selectedRecordingId.value = id
    }

    async function fetchRecordingEvents() {
      await logsStore.fetchRecordingEvents(selectedRecordingId.value)
    }

    async function fetchRecordings() {
      await logsStore.fetchRecordings()
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
        await chatStore.runCommand('/despliegue_iniciar_instancia', async (loadingIdx, sid) => {
          if (cmd) {
            return cmd.execute([], { cmdStore, chatStore, loadingIdx, sessionId: sid })
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

    function toggleQueryForm() {
      showQueryForm.value = !showQueryForm.value
      if (!showQueryForm.value) {
        queryResult.value = null
      }
    }

    function formatQueryResult(result) {
      if (!result || result.found === false) return '—'
      const val = result.value
      if (val === null || val === undefined) return 'null'
      if (typeof val === 'boolean') return val ? 'true' : 'false'
      if (typeof val === 'number') return String(val)
      return String(val)
    }

    async function executeQuery() {
      const selector = querySelector.value.trim()
      if (!selector || !hasBrowserSession.value) return

      queryExecuting.value = true
      queryResult.value = null
      try {
        const data = await browserStore.evaluateSelector(selector, queryExtractType.value, queryAttributeName.value || null, activeSessionId.value)
        if (data.error) throw new Error(data.error)
        queryResult.value = data

        if (querySaveToRecording.value && selectedRecordingId.value !== undefined && activeSessionId.value) {
          try {
            const meta = { extract_type: queryExtractType.value }
            if (queryAttributeName.value) meta.attribute_name = queryAttributeName.value

            const res = await fetch(`/api/playwright-logs/events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                chat_session_id: activeSessionId.value,
                recording_id: selectedRecordingId.value,
                event_type: 'query',
                selector,
                value: data.found ? String(data.value) : null,
                metadata: JSON.stringify(meta),
              }),
            })
            if (res.ok) {
              await fetchRecordingEvents()
            }
          } catch (err) {
            console.error('Error al guardar evento query:', err.message)
          }
        }

        let msgContent = `🔍 Consulta: ${selector} (${queryExtractType.value})`
        if (data.found) {
          const formatted = formatQueryResult(data)
          msgContent += ` → Resultado: ${formatted}`
        } else {
          msgContent += ` → Elemento no encontrado`
        }
        try {
          await fetch(`/api/chat/sessions/${activeSessionId.value}/save-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              messages: [{ role: 'result', content: msgContent }],
            }),
          })
          chatStore.pushMessage({ role: 'result', content: msgContent }, activeSessionId.value)
        } catch (e) {
          console.error('Error al enviar consulta al chat:', e.message)
        }
      } catch (err) {
        console.error('Error al ejecutar consulta:', err.message)
        queryResult.value = { found: false, value: null, error: err.message }
      } finally {
        queryExecuting.value = false
      }
    }

    async function sendQueryResultToChat() {
      if (!queryResult.value || !activeSessionId.value) return
      const selector = querySelector.value.trim()
      let msgContent = `🔍 Consulta: ${selector} (${queryExtractType.value})`
      if (queryResult.value.found) {
        msgContent += ` → Resultado: ${formatQueryResult(queryResult.value)}`
      } else {
        msgContent += ` → Elemento no encontrado`
      }
      try {
        await fetch(`/api/chat/sessions/${activeSessionId.value}/save-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messages: [{ role: 'result', content: msgContent }],
          }),
        })
        chatStore.pushMessage({ role: 'result', content: msgContent }, activeSessionId.value)
      } catch (e) {
        console.error('Error al enviar consulta al chat:', e.message)
      }
    }

    async function doStartRecording(recordingId) {
      const sessionId = activeSessionId.value
      if (!sessionId) return
      const result = await browserStore.startRecording(recordingId, sessionId)
      if (result.error) {
        recordError.value = result.error
      }
    }

    async function stopRecording() {
      const sessionId = activeSessionId.value
      if (!sessionId) return
      const result = await browserStore.stopRecording(sessionId)
      if (result.error) {
        recordError.value = result.error
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

    async function startRecordingOn(rec) {
      selectedRecordingId.value = rec.id
      await doStartRecording(rec.id)
    }

    async function deleteRecording(rec) {
      if (!confirm(`¿Eliminar "${rec.name}"? Los eventos pasarán a "No catalogado".`)) return
      try {
        await logsStore.deleteRecording(rec.id)
        if (selectedRecordingId.value === rec.id) {
          selectedRecordingId.value = null
        }
      } catch (err) {
        console.error('Error al eliminar grabación:', err)
      }
    }

    function startRename(rec) {
      editingRecordingId.value = rec.id
      editName.value = rec.name
    }

    async function saveRename(rec) {
      const name = editName.value.trim()
      if (!name) {
        cancelRename()
        return
      }
      try {
        await logsStore.updateRecording(rec.id, { name })
      } catch (err) {
        console.error('Error al renombrar grabación:', err)
      }
      editingRecordingId.value = null
      editName.value = ''
    }

    function cancelRename() {
      editingRecordingId.value = null
      editName.value = ''
    }

    async function cloneRecording(rec) {
      try {
        const cloned = await logsStore.cloneRecording(rec.id)
      } catch (err) {
        console.error('Error al clonar grabación:', err)
      }
    }

    function onRecordingListResizeStart(e) {
      const startX = e.clientX
      const startWidth = uiStore.recordingListWidth

      function onMouseMove(e) {
        const newWidth = Math.max(140, Math.min(400, startWidth + e.clientX - startX))
        uiStore.recordingListWidth = newWidth
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        uiStore.saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
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
      query: 'Consulta',
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
        query: 'bg-query-subtle text-query',
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
      if (evt.event_type === 'query') {
        let meta = {}
        try { meta = evt.metadata ? (typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata) : {} } catch (e) {}
        const extractType = meta.extract_type || 'text'
        const desc = `"${evt.selector}" (${extractType})`
        if (evt.value != null) {
          return `${label}: ${desc} → "${String(evt.value).substring(0, 120)}"`
        }
        return `${label}: ${desc}`
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

    function eventToAction(evt) {
      switch (evt.event_type) {
        case 'click':
        case 'dblclick':
          return { type: 'click', selector: evt.selector }
        case 'input':
        case 'change':
          if (evt.tag_name === 'select') {
            return { type: 'select', selector: evt.selector, value: evt.value || '' }
          }
          return { type: 'fill', selector: evt.selector, value: evt.value || '' }
        case 'submit':
          return { type: 'submit', selector: evt.selector }
        case 'keydown':
          return { type: 'press', selector: evt.selector, key: evt.key || 'Enter' }
        case 'scroll':
          return { type: 'scroll', x: evt.scroll_x || 0, y: evt.scroll_y || 0 }
        case 'query': {
          let meta = {}
          try { meta = evt.metadata ? (typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata) : {} } catch (e) {}
          return { type: 'query', selector: evt.selector, extractType: meta.extract_type || 'value', attributeName: meta.attribute_name || null }
        }
        default:
          return null
      }
    }

    function describeAction(evt) {
      const label = EVENT_LABELS[evt.event_type] || evt.event_type
      switch (evt.event_type) {
        case 'click': return `Click en "${evt.text_content || evt.selector}"`
        case 'input': return `Escribir "${evt.value}" en "${evt.text_content || evt.selector}"`
        case 'change': return `Cambiar "${evt.text_content || evt.selector}" a "${evt.value}"`
        case 'submit': return `Submit formulario "${evt.text_content || evt.selector}"`
        case 'keydown': return `Presionar tecla "${evt.key}" en "${evt.text_content || evt.selector}"`
        case 'scroll': return `Scroll a (${evt.scroll_x}, ${evt.scroll_y})`
        case 'query': {
          let meta = {}
          try { meta = evt.metadata ? (typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata) : {} } catch (e) {}
          const extractType = meta.extract_type || 'text'
          const result = evt.value != null ? ` → "${String(evt.value).substring(0, 80)}"` : ''
          return `Consultar "${evt.selector}" (${extractType})${result}`
        }
        default: return `${label}: ${evt.text_content || evt.selector || ''}`
      }
    }

    async function replayRecording() {
      if (!selectedRecordingId.value || !activeSessionId.value) return

      if (isRecording.value && currentRecordingId.value) {
        await browserStore.stopRecording(activeSessionId.value)
      }

      replaying.value = true
      replayCancelled.value = false
      replayProgress.value = { current: 0, total: 0 }

      let targetSessionId = Number(activeSessionId.value)
      try {
        const statusRes = await fetch('/api/navegador/status', { credentials: 'include' })
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          if (statusData.hasActiveSession && statusData.originalSessionId) {
            targetSessionId = Number(statusData.originalSessionId)
          }
        }
      } catch (e) {
        console.error('Error al verificar sesión del navegador:', e.message)
      }

      try {
        const res = await fetch(`/api/playwright-logs/events?recording_id=${selectedRecordingId.value}&order=asc`, {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Error al obtener eventos')
        const events = await res.json()

        const recording = logsStore.recordings.find(r => r.id === selectedRecordingId.value)
        const recordingName = recording ? recording.name : 'Grabación'

        const interval = settingsStore.replayIntervalMs || 1000

        const actionEntries = events.map(e => ({ action: eventToAction(e), event: e })).filter(a => a.action !== null)
        replayProgress.value.total = actionEntries.length

        ;(async () => {
          const isActive = Number(targetSessionId) === Number(activeSessionId.value)
          const msg = { role: 'command', content: `▶ Reproduciendo grabación: "${recordingName}" (${actionEntries.length} acciones)` }
          if (isActive) {
            await fetch(`/api/chat/sessions/${targetSessionId}/save-messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ messages: [msg] }),
            })
          }
          chatStore.pushMessage(msg, targetSessionId)
        })().catch(e => console.error('Error al enviar inicio al chat:', e.message))

        for (let i = 0; i < actionEntries.length; i++) {
          if (replayCancelled.value) break

          replayProgress.value.current = i + 1
          const { action, event: evt } = actionEntries[i]

          try {
            let execData, desc

            if (action.type === 'query') {
              const qData = await browserStore.evaluateSelector(action.selector, action.extractType || 'value', action.attributeName || null, activeSessionId.value)
              if (qData.error) throw new Error(qData.error)
              execData = qData
              const resultStr = qData.found ? String(qData.value).substring(0, 80) : 'no encontrado'
              desc = `Consultar "${action.selector}" → ${resultStr}`

              if (evt && evt.id && qData.found) {
                try {
                  await fetch(`/api/playwright-logs/events/${evt.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ value: String(qData.value) }),
                  })
                } catch (e) {
                  console.error('Error al actualizar evento query con resultado:', e.message)
                }
              }
            } else {
              execData = await browserStore.executeAction(action, activeSessionId.value)
              if (execData.error) throw new Error(execData.error)
              desc = describeAction(evt)
            }

            ;(async () => {
              const isActive = Number(targetSessionId) === Number(activeSessionId.value)
              const msg = { role: 'result', content: `Paso ${i + 1}/${actionEntries.length}: ${desc}` }
              if (isActive) {
                await fetch(`/api/chat/sessions/${targetSessionId}/save-messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ messages: [msg] }),
                })
              }
              chatStore.pushMessage(msg, targetSessionId)
            })().catch(e => console.error('Error al enviar paso al chat:', e.message))
          } catch (err) {
            console.error(`Error ejecutando paso ${i + 1}:`, err.message)
            ;(async () => {
              const isActive = Number(targetSessionId) === Number(activeSessionId.value)
              const msg = { role: 'result', content: `❌ Paso ${i + 1}/${actionEntries.length}: Error - ${err.message}` }
              if (isActive) {
                await fetch(`/api/chat/sessions/${targetSessionId}/save-messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ messages: [msg] }),
                })
              }
              chatStore.pushMessage(msg, targetSessionId)
            })().catch(e => console.error('Error al reportar fallo al chat:', e.message))
          }

          if (i < actionEntries.length - 1 && !replayCancelled.value) {
            await new Promise(r => setTimeout(r, interval))
          }
        }

        const completed = !replayCancelled.value
        const summary = completed
          ? `✅ Reproducción completada: ${replayProgress.value.current}/${replayProgress.value.total} acciones ejecutadas.`
          : `⏹ Reproducción cancelada: ${replayProgress.value.current}/${replayProgress.value.total} acciones ejecutadas.`
        ;(async () => {
          const isActive = Number(targetSessionId) === Number(activeSessionId.value)
          const msg = { role: 'result', content: summary }
          if (isActive) {
            await fetch(`/api/chat/sessions/${targetSessionId}/save-messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ messages: [msg] }),
            })
          }
          chatStore.pushMessage(msg, targetSessionId)
        })().catch(e => console.error('Error al enviar resumen al chat:', e.message))
      } catch (err) {
        console.error('Error en reproducción:', err.message)
      } finally {
        replaying.value = false
        replayCancelled.value = false
        replayProgress.value = { current: 0, total: 0 }
      }
    }

    function cancelReplay() {
      replayCancelled.value = true
    }

    async function fetchStatus() {
      await browserStore.fetchStatus()
    }

    async function pollRecordings() {
      await fetchRecordings()
      await fetchRecordingEvents()
    }

    watch(selectedRecordingId, async () => {
      await fetchRecordingEvents()
    })

    watch(() => logsStore.recordingEvents, async () => {
      if (!isRecording.value) return
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
      document.addEventListener('mousedown', onDocumentClick)
    })

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer)
      if (statusTimer) clearInterval(statusTimer)
      if (recordingPollTimer) clearInterval(recordingPollTimer)
      document.removeEventListener('mousedown', onDocumentClick)
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
      editingRecordingId,
      editName,
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
      contextMenu,
      showContextMenu,
      closeContextMenu,
      deleteContextEvent,
      deleteSingleEvent,
      startingInstancia,
      iniciarInstancia,
      stopRecording,
      clearEvents,
      deleteRecording,
      startRecordingOn,
      startRename,
      saveRename,
      cancelRename,
      cloneRecording,
      onRecordingListResizeStart,
      replaying,
      replayProgress,
      replayRecording,
      cancelReplay,
      showQueryForm,
      querySelector,
      queryExtractType,
      queryAttributeName,
      queryExecuting,
      queryResult,
      querySaveToRecording,
      querySaving,
      toggleQueryForm,
      executeQuery,
      sendQueryResultToChat,
      formatQueryResult,
      typeClass,
      describeEvent,
      isExpanded,
      toggleExpand,
      formatTime,
      formatJson,
      uiStore,
      deletingEventId,
    }
  },
}
</script>

<style scoped>
.events-panel {
  background: #0d1117;
}
.recording-list {
  position: relative;
  min-width: 140px;
  max-width: 400px;
  background: #161b22;
}

.recording-list-resize-handle {
  position: absolute;
  top: 0;
  right: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recording-list-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}

.recording-list-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}

.recording-list-resize-handle:hover .recording-list-resize-handle-bar {
  background: #75AADB;
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
.event-delete-btn {
  background: rgba(239, 68, 68, 0.2) !important;
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
  color: #ef4444 !important;
  font-size: 0.65rem !important;
  line-height: 1 !important;
  min-width: 20px;
  min-height: 18px;
  border-radius: 3px !important;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.event-delete-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.35) !important;
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
.query-form {
  background: #161b22;
}
.query-result-value {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  color: #22c55e;
  word-break: break-all;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bg-query-subtle {
  background-color: rgba(168, 85, 247, 0.15) !important;
}
.text-query {
  color: #a855f7 !important;
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
.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9998;
}
.context-menu {
  position: fixed;
  z-index: 9999;
  background: #1a2744;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.context-menu-item {
  padding: 6px 14px;
  font-size: 0.72rem;
  color: #e6edf3;
  cursor: pointer;
  transition: background 0.1s;
}
.context-menu-item:hover {
  background: rgba(117, 170, 219, 0.15);
  color: #75AADB;
}
</style>
