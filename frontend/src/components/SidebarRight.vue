<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed, transitioning: rightPanelTransitioning }"
    :style="rightPanelCollapsed ? {} : { width: rightPanelWidth + 'px', minWidth: rightPanelWidth + 'px' }"
  >
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button class="tab-btn" :class="{ active: tab === 'comentarios' }" @click="selectTab('comentarios')">Comentarios</button>
      <button class="tab-btn" :class="{ active: tab === 'archivos' }" @click="selectTab('archivos')">Archivos</button>
      <button class="tab-btn" :class="{ active: tab === 'variables' }" @click="selectTab('variables')">Variables</button>
      <button class="tab-btn" :class="{ active: tab === 'comandos' }" @click="selectTab('comandos')">Comandos</button>
    </div>

    <template v-if="tab === 'comentarios'">
      <div v-if="!sessionWithTicket" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span v-if="!activeSession">Seleccione una sesión de chat</span>
        <span v-else>Sin ticket vinculado a esta sesión</span>
      </div>
      <div v-else-if="loading" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
        <span>Cargando comentarios…</span>
      </div>
      <div v-else-if="comments.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>No hay comentarios encolados para este ticket</span>
      </div>
      <div v-else class="comments-list flex-grow-1 overflow-y-auto px-2 py-1">
        <div v-if="hasSentComments" class="d-flex px-1 pb-1">
          <button class="btn btn-sm btn-outline-secondary ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="deleteSentComments">Limpiar enviados</button>
        </div>
        <div v-for="c in comments" :key="c.id" class="comment-item d-flex flex-column px-2 py-2 mb-1 rounded">
          <button class="delete-btn" @click.stop="deleteComment(c)" title="Eliminar comentario">×</button>
          <div class="d-flex align-items-center gap-1 mb-1">
            <span class="badge" :class="badgeClass(c.estado)">{{ c.estado }}</span>
            <span class="text-muted" style="font-size: 0.65rem;">#{{ c.ticket_redmine_id }}</span>
            <span class="ms-auto text-muted" style="font-size: 0.6rem;">{{ formatDate(c.created_at) }}</span>
          </div>
          <div class="comment-preview text-light small text-truncate">{{ c.comentario }}</div>
        </div>
      </div>
    </template>
    <template v-else-if="tab === 'archivos'">
      <div class="archivos-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
        <div class="archivos-tree-panel flex-shrink-0 overflow-hidden" :style="{ width: archivosTreeWidth + 'px' }">
          <FileTreePanel :session-id="activeSessionId" @file-selected="onFileSelected" />
        </div>
        <div class="archivos-splitter" @mousedown.prevent="onArchivosSplitStart"></div>
        <FilePreviewPanel class="flex-grow-1 overflow-hidden" :file-path="selectedFilePath" />
      </div>
    </template>
    <template v-else-if="tab === 'variables'">
      <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Seleccione una sesión de chat</span>
      </div>
      <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Sin proyecto asignado a esta sesión</span>
      </div>
      <div v-else-if="loadingVariables" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
        <span>Cargando variables…</span>
      </div>
      <div v-else-if="variables.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>No hay variables definidas para este proyecto</span>
      </div>
      <div v-else class="variables-list flex-grow-1 overflow-y-auto px-2 py-1">
        <div v-for="v in variables" :key="v.key" class="variable-item d-flex align-items-start px-2 py-2 mb-1 rounded"
          @click="openVariableDetail(v)" role="button">
          <span class="variable-key text-nowrap">{{ v.key }}</span>
          <span class="variable-sep mx-1 text-muted">=</span>
          <span class="variable-value small">{{ truncateValue(v.value) }}</span>
          <span v-if="v.type === 'memory'" class="badge bg-info ms-1" style="font-size: 0.55rem; line-height: 1.2; align-self: center;">mem</span>
        </div>
      </div>
    </template>
    <template v-else-if="tab === 'comandos'">
      <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Seleccione una sesión de chat</span>
      </div>
      <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Sin proyecto asignado a esta sesión</span>
      </div>
      <div v-else-if="loadingComandos" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
        <span>Cargando comandos…</span>
      </div>
      <div v-else-if="comandos.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>No hay comandos personalizados para este proyecto</span>
        <button class="btn btn-sm btn-outline-argentina mt-2" style="font-size: 0.7rem;" @click.stop="crearComando">+ Crear comando</button>
      </div>
      <div v-else class="comandos-list flex-grow-1 overflow-y-auto px-2 py-1">
        <button class="btn btn-sm btn-outline-argentina w-100 mb-2" style="font-size: 0.7rem;" @click.stop="crearComando">+ Crear comando</button>
        <div v-for="c in comandos" :key="c.id" class="comando-item d-flex flex-column px-2 py-2 mb-1 rounded">
          <div class="d-flex align-items-center gap-1 mb-1">
            <span class="comando-label small fw-semibold text-truncate">{{ c.label }}</span>
          </div>
          <div v-if="c.descripcion" class="comando-desc text-muted small text-truncate mb-2">{{ c.descripcion }}</div>
          <div class="d-flex gap-1 justify-content-end">
            <button v-if="!executingCommands.has(c.id)" class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.65rem;" @click.stop="ejecutarComando(c)">▶ Ejecutar</button>
            <button v-else class="btn btn-sm btn-outline-warning py-0 px-2" style="font-size: 0.65rem;" @click.stop="detenerComando(c)">⏹ Detener</button>
            <button class="btn btn-sm btn-outline-info py-0 px-2" style="font-size: 0.65rem;" @click.stop="editarComando(c)">✏</button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size: 0.65rem;" @click.stop="eliminarComando(c)">🗑</button>
          </div>
        </div>
      </div>
    </template>
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../stores/ui.js'
import { useChatStore } from '../stores/chat.js'
import { useRedmineCommentsStore } from '../stores/redmineComments.js'
import { useProjectVariablesStore } from '../stores/projectVariables.js'
import { useComandosPersonalizadosStore } from '../stores/comandosPersonalizados.js'
import { useModalStore } from '../stores/modal.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import VariableDetailModal from './VariableDetailModal.vue'
import FileTreePanel from './FileTreePanel.vue'
import FilePreviewPanel from './FilePreviewPanel.vue'

export default {
  components: { FileTreePanel, FilePreviewPanel },
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const modal = useModalStore()
    const redmineComments = useRedmineCommentsStore()
    const projectVariables = useProjectVariablesStore()
    const comandosStore = useComandosPersonalizadosStore()
    const { rightPanelCollapsed, rightPanelWidth, sidebarRightTab } = storeToRefs(ui)
    const { activeSessionId, sessions } = storeToRefs(chat)
    const tab = ref('comentarios')
    const stopTabSync = watch(sidebarRightTab, (v) => { tab.value = v; stopTabSync() })

    const comments = computed(() => {
      const list = redmineComments.commentsBySession[activeSessionId.value] || []
      return [...list].sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1
        if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1
        return new Date(a.created_at) - new Date(b.created_at)
      })
    })
    const loading = computed(() => redmineComments.loadingBySession[activeSessionId.value] || false)
    const hasSentComments = computed(() => comments.value.some(c => c.estado === 'enviado'))

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)
    const variables = computed(() => projectVariables.variablesByProject[proyectoId.value] || [])
    const loadingVariables = computed(() => projectVariables.loadingByProject[proyectoId.value] || false)
    const comandos = computed(() => comandosStore.getCommandsForProject(proyectoId.value))
    const loadingComandos = computed(() => comandosStore.loadingByProject[proyectoId.value] || false)

    const rightPanelTransitioning = ref(false)
    let transitionTimer = null

    const selectedFilePath = ref(null)
    const archivosTreeWidth = ref(140)

    function onFileSelected({ path, name }) {
      selectedFilePath.value = path
    }

    function onArchivosSplitStart(e) {
      const startX = e.clientX
      const startWidth = archivosTreeWidth.value
      const container = e.target.closest('.archivos-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        archivosTreeWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const sessionWithTicket = computed(() => {
      return activeSession.value?.id_ticket_redmine || null
    })

    function selectTab(val) {
      tab.value = val
      sidebarRightTab.value = val
      ui.saveLayoutPrefs()
    }

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    function truncateValue(val) {
      if (!val) return ''
      const str = String(val)
      return str.length > 50 ? str.substring(0, 50) + '…' : str
    }

    function openVariableDetail(variable) {
      modal.open(VariableDetailModal, { variable }, { title: variable.key })
    }

    async function deleteComment(c) {
      if (!confirm('¿Eliminar este comentario?')) return
      try {
        await redmineComments.deleteComment(c.id, activeSessionId.value)
      } catch (err) {
        console.error('Error al eliminar comentario:', err)
      }
    }

    async function deleteSentComments() {
      if (!confirm('¿Eliminar todos los comentarios ya enviados?')) return
      try {
        await redmineComments.deleteSentComments(activeSessionId.value)
      } catch (err) {
        console.error('Error al eliminar comentarios enviados:', err)
      }
    }

    function badgeClass(estado) {
      return {
        pendiente: 'bg-warning text-dark',
        enviado: 'bg-success',
        error: 'bg-danger',
      }[estado] || 'bg-secondary'
    }

    watch(activeSessionId, (newId) => {
      if (!newId) {
        redmineComments.clearComments()
        return
      }
      const session = sessions.value.find(s => s.id === newId)
      if (session?.id_ticket_redmine) {
        redmineComments.loadComments(session.id_ticket_redmine, newId)
      } else {
        redmineComments.clearComments()
      }
    })

    watch(proyectoId, (newId) => {
      if (!newId) {
        projectVariables.clearVariables()
        comandosStore.clearCommands()
        return
      }
      projectVariables.loadVariables(newId)
      comandosStore.loadCommands(newId)
    })

    const executingCommands = ref(new Map())

    function _updateStreamMsg(streamKey, content) {
      const idx = chat.messages.findIndex(m => m._key === streamKey)
      if (idx >= 0) {
        chat.messages[idx].content = content
      }
    }

    async function ejecutarComando(c) {
      const sid = activeSessionId.value
      if (!sid || executingCommands.value.has(c.id)) return

      const abortController = new AbortController()
      executingCommands.value.set(c.id, abortController)

      const cmdKey = 'cmd-sb-' + Date.now()
      const streamKey = 'stream-sb-' + Date.now()
      const isActive = () => Number(chat.activeSessionId) === Number(sid)

      if (isActive()) {
        chat.messages.push({ role: 'command', content: `$ ${c.label}`, _key: cmdKey })
        chat.flashLed(sid)
        chat.messages.push({ role: 'result', content: '⏳ Ejecutando...', _key: streamKey })
        chat.flashLed(sid)
      }
      chat.setSessionStatus(sid, 'executing')

      const done = () => {
        executingCommands.value.delete(c.id)
        chat.setSessionStatus(sid, 'idle')
      }

      let fullOutput = ''
      try {
        const res = await fetch(`/api/comandos-personalizados/${c.id}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId: sid }),
          signal: abortController.signal,
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al ejecutar comando')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const line of lines) {
            const t = line.trim()
            if (!t || t === 'data: [DONE]') continue
            if (!t.startsWith('data: ')) continue
            try {
              const json = JSON.parse(t.slice(6))
              if (json.type === 'stdout' || json.type === 'stderr') {
                fullOutput += json.content
                if (isActive()) _updateStreamMsg(streamKey, fullOutput)
              } else if (json.type === 'error') {
                fullOutput += '\n[Error: ' + json.content + ']'
              }
            } catch {}
          }
        }

        const finalContent = fullOutput || '(sin salida)'
        await fetch(`/api/chat/sessions/${sid}/save-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messages: [
              { role: 'command', content: `$ ${c.label}` },
              { role: 'result', content: finalContent },
            ],
          }),
        })
        if (isActive()) _updateStreamMsg(streamKey, finalContent)
      } catch (err) {
        if (err.name === 'AbortError') {
          const finalContent = '(ejecución detenida)'
          await fetch(`/api/chat/sessions/${sid}/save-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              messages: [
                { role: 'command', content: `$ ${c.label}` },
                { role: 'result', content: finalContent },
              ],
            }),
          })
          if (isActive()) _updateStreamMsg(streamKey, finalContent)
        } else {
          console.error('Error ejecutando comando:', err)
          chat.setSessionStatus(sid, 'error')
          if (isActive()) _updateStreamMsg(streamKey, 'Error: ' + err.message)
        }
      } finally {
        done()
      }
    }

    function detenerComando(c) {
      const abortController = executingCommands.value.get(c.id)
      if (abortController) {
        abortController.abort()
      }
    }

    function crearComando() {
      const sid = activeSessionId.value
      if (!sid || !proyectoId.value) return
      chat.pushMessage({
        role: 'opencode_control',
        content: JSON.stringify({
          controlId: 'comando-edit-create-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'create',
          proyectoId: proyectoId.value,
        }),
        controlData: {
          controlId: 'comando-edit-create-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'create',
          proyectoId: proyectoId.value,
        },
        _key: 'ctrl-comando-' + Date.now(),
      })
    }

    async function editarComando(c) {
      const sid = activeSessionId.value
      if (!sid) return
      chat.pushMessage({
        role: 'opencode_control',
        content: JSON.stringify({
          controlId: 'comando-edit-update-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'update',
          id: c.id,
          proyectoId: c.id_proyecto,
          label: c.label,
          descripcion: c.descripcion || '',
          comando: c.comando,
        }),
        controlData: {
          controlId: 'comando-edit-update-' + Date.now(),
          controlType: 'comando_edit',
          mode: 'update',
          id: c.id,
          proyectoId: c.id_proyecto,
          label: c.label,
          descripcion: c.descripcion || '',
          comando: c.comando,
        },
        _key: 'ctrl-comando-' + Date.now(),
      })
    }

    async function eliminarComando(c) {
      if (!confirm(`¿Eliminar el comando "${c.label}"?`)) return
      try {
        await comandosStore.deleteCommand(c.id, proyectoId.value)
        if (Number(chat.activeSessionId) === Number(activeSessionId.value) && activeSessionId.value) {
          chat.pushMessage({ role: 'result', content: `✓ Comando "${c.label}" eliminado.`, _key: 'del-' + Date.now() })
        }
      } catch (err) {
        console.error('Error al eliminar comando:', err)
      }
    }

    function onResizeStart(e) {
      rightPanelTransitioning.value = false

      function onMouseMove(e) {
        const leftWidth = ui.sidebarCollapsed ? 0 : ui.sidebarWidth
        const maxAllowed = Math.max(window.innerWidth * 0.05, window.innerWidth - leftWidth - window.innerWidth * 0.05)
        rightPanelWidth.value = Math.max(window.innerWidth * 0.05, Math.min(maxAllowed, window.innerWidth - e.clientX))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        ui.saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    watch(rightPanelCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      rightPanelTransitioning.value = true
      transitionTimer = setTimeout(() => {
        rightPanelTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    return {
      rightPanelCollapsed,
      rightPanelWidth,
      rightPanelTransitioning,
      tab,
      selectTab,
      activeSessionId,
      activeSession,
      sessionWithTicket,
      comments,
      loading,
      hasSentComments,
      proyectoId,
      variables,
      loadingVariables,
      comandos,
      loadingComandos,
      formatDate,
      badgeClass,
      deleteComment,
      deleteSentComments,
      truncateValue,
      openVariableDetail,
      ejecutarComando,
      detenerComando,
      crearComando,
      editarComando,
      eliminarComando,
      executingCommands,
      onResizeStart,
      selectedFilePath,
      archivosTreeWidth,
      onFileSelected,
      onArchivosSplitStart,
    }
  },
}
</script>

<style scoped>
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
.comments-list {
  background: #16213e;
}
.comment-item {
  background: #1a2744;
  border: 1px solid #374151;
  position: relative;
}
.comment-item:hover {
  background: #1e3050;
}
.delete-btn {
  display: none;
  position: absolute;
  top: 2px;
  right: 2px;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  line-height: 1.2;
  border-radius: 3px;
  z-index: 2;
}
.comment-item:hover .delete-btn {
  display: block;
}
.delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
.comment-preview {
  font-size: 0.7rem;
  line-height: 1.3;
  color: #cbd5e1;
}
.sidebar-right {
  position: relative;
  padding: 8px;
  border-left: 1px solid #374151;
  background: #1a1a2e;
}
.sidebar-right.transitioning {
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
}
.sidebar-right.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0;
  border: none;
  overflow: hidden;
}
.sidebar-right-resize-handle {
  position: absolute;
  top: 0;
  left: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-right-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.sidebar-right-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.sidebar-right-resize-handle:hover .sidebar-right-resize-handle-bar {
  background: #75AADB;
}
.variables-list {
  background: #16213e;
}
.variable-item {
  background: #1a2744;
  border: 1px solid #374151;
  cursor: pointer;
}
.variable-item:hover {
  background: #1e3050;
}
.variable-key {
  color: #75AADB;
  font-size: 0.75rem;
  font-family: monospace;
  font-weight: 600;
  flex-shrink: 0;
}
.variable-value {
  color: #cbd5e1;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  line-height: 1.4;
}
.variable-sep {
  font-family: monospace;
  font-size: 0.75rem;
}
.comandos-list {
  background: #16213e;
}
.comando-item {
  background: #1a2744;
  border: 1px solid #374151;
  position: relative;
}
.comando-item:hover {
  background: #1e3050;
}
.comando-label {
  color: #75AADB;
}
.comando-desc {
  font-size: 0.65rem;
  line-height: 1.2;
}
.archivos-container {
  min-height: 0;
}
.archivos-tree-panel {
  min-width: 80px;
}
.archivos-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.archivos-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
</style>
