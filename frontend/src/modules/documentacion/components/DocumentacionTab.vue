<template>
  <div class="documentacion-panel d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;">
    <template v-if="!proyectoId">
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Seleccione una sesión de chat</span>
      </div>
    </template>
    <template v-else-if="!proyectoId">
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Sin proyecto asignado a esta sesión</span>
      </div>
    </template>
    <template v-else-if="loading">
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
        <span>Cargando notas…</span>
      </div>
    </template>
    <template v-else>
      <div class="doc-notas-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
        <div class="doc-notas-list flex-shrink-0 overflow-y-auto" :style="{ width: listWidth + 'px' }">
          <button class="btn btn-sm btn-outline-argentina w-100 mb-2" style="font-size: 0.7rem;" @click.stop="abrirCrear">
            + Agregar nota
          </button>
          <div v-if="notas.length === 0" class="d-flex align-items-center justify-content-center text-secondary small px-3 py-4 text-center">
            <span>Sin notas de documentación</span>
          </div>
          <div v-for="n in notas" :key="n.id"
            class="doc-nota-item d-flex align-items-start px-2 py-2 mb-1 rounded position-relative"
            :class="{ selected: selectedNota?.id === n.id }"
            @click="seleccionarNota(n)" role="button">
            <div class="doc-nota-info min-width-0 flex-grow-1">
              <div class="doc-nota-clave text-truncate small fw-semibold">{{ n.clave }}</div>
              <div class="doc-nota-ticket text-muted" style="font-size: 0.6rem;">{{ n.id_ticket ? '#' + n.id_ticket : 'General' }}</div>
            </div>
            <button class="doc-nota-delete-btn" title="Eliminar nota" @click.stop="eliminarNota(n)">×</button>
          </div>
        </div>
        <div class="doc-notas-splitter" @mousedown.prevent="onSplitStart"></div>
        <div v-if="selectedNota" class="doc-notas-editor flex-grow-1 d-flex flex-column overflow-hidden">
          <div class="d-flex align-items-center gap-2 px-2 py-1 flex-shrink-0" style="border-bottom: 1px solid #374151;">
            <input v-if="!previewMode" ref="claveEditInput" v-model="editClave" @input="sanitizeClave"
              class="doc-nota-clave-input flex-grow-1" maxlength="255" />
            <span v-else class="small text-light fw-semibold text-truncate">{{ selectedNota.clave }}</span>
            <span class="text-muted" style="font-size: 0.6rem;">{{ selectedNota.id_ticket ? '#' + selectedNota.id_ticket : 'General' }}</span>
            <label class="d-flex align-items-center gap-1 ms-2" style="cursor: pointer; font-size: 0.65rem; color: #9ca3af; user-select: none;">
              <span>{{ isJson ? 'JSON' : 'MD' }}</span>
              <input type="checkbox" v-model="previewMode" class="form-check-input m-0" style="width: 14px; height: 14px; cursor: pointer;" />
            </label>
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 0.65rem;" @click="copiarContenido" title="Copiar contenido">📋</button>
            <button v-if="!previewMode" class="btn btn-sm btn-outline-success ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="guardarNota" :disabled="!editValor">Guardar</button>
          </div>
          <textarea v-if="!previewMode" class="doc-notas-textarea flex-grow-1 w-100 border-0 p-2"
            :maxlength="MAX_VALOR"
            v-model="editValor"
            placeholder="Escriba la documentación aquí…"></textarea>
          <div v-else-if="isJson" class="doc-notas-preview flex-grow-1 w-100 overflow-auto p-2"><JsonTreeView :data="parsedJson" /></div>
          <div v-else class="doc-notas-preview flex-grow-1 w-100 overflow-auto p-2"><ChatFormatter :text="editValor" /></div>
          <div v-if="!previewMode" class="d-flex justify-content-end px-2 py-1" style="font-size: 0.6rem; color: #6b7280; border-top: 1px solid #374151;">
            <span>{{ editValor?.length || 0 }} / {{ MAX_VALOR }}</span>
          </div>
        </div>
        <div v-else class="doc-notas-editor flex-grow-1 d-flex align-items-center justify-content-center text-secondary small px-3 text-center">
          <span>Seleccione una nota para editar</span>
        </div>
        <div class="doc-notas-splitter" @mousedown.prevent="onToolsSplitStart"></div>
        <div class="doc-notas-tools flex-shrink-0 overflow-hidden d-flex flex-column" :style="{ width: toolsWidth + 'px' }">
          <div class="doc-notas-tools-header">Herramientas</div>
          <div class="doc-notas-tools-body d-flex flex-column flex-grow-1 p-2 overflow-hidden">
            <textarea v-model="agentInstructions" class="doc-notas-agent-input flex-shrink-0"
              placeholder="Instrucciones adicionales…" :disabled="agentLoading"></textarea>
            <button class="btn btn-sm btn-outline-secondary w-100 mb-1" style="font-size:0.65rem;"
              @click="openAgentPromptModal" :disabled="agentLoading">Editar Prompt Sistema</button>
            <button class="btn btn-sm btn-outline-success w-100" style="font-size:0.65rem;"
              @click="generateJson" :disabled="agentLoading || !selectedNota">
              <span v-if="agentLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
              Generar JSON
            </button>
            <div v-if="agentError" class="text-danger small px-1 py-1 mt-1">{{ agentError }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { watch, ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useDocumentacionNotasStore } from '../../../stores/documentacionNotas.js'
import { useChatStore } from '../../../stores/chat.js'
import { useModalStore } from '../../../stores/modal.js'
import { settingGet, settingSet } from '../../../services/settingService.js'
import ChatFormatter from '../../../components/chat/ChatFormatter.vue'
import JsonTreeView from '../../../components/utils/JsonTreeView.vue'
import DocCreateModal from './DocCreateModal.vue'
import DocAgentPromptModal from './DocAgentPromptModal.vue'

const LIST_WIDTH_KEY = 'doc_notas_list_width'
const LIST_MIN = 100
const LIST_DEFAULT = 160
const MAX_VALOR = 16384

const TOOLS_WIDTH_KEY = 'doc_notas_tools_width'
const TOOLS_MIN = 50
const TOOLS_DEFAULT = 120

const AGENT_SYSTEM_PROMPT_KEY = 'doc_agent_system_prompt'

export default {
  components: { ChatFormatter, JsonTreeView, DocCreateModal, DocAgentPromptModal },
  setup() {
    const store = useDocumentacionNotasStore()
    const chat = useChatStore()
    const modal = useModalStore()
    const { sessions, activeSessionId } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })
    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)
    const ticketId = computed(() => activeSession.value?.id_ticket_redmine || null)

    const listWidth = ref(LIST_DEFAULT)
    const toolsWidth = ref(TOOLS_DEFAULT)
    const selectedNota = ref(null)
    const editValor = ref('')
    const editClave = ref('')
    const previewMode = ref(false)
    const claveEditInput = ref(null)

    const agentInstructions = ref('')
    const agentLoading = ref(false)
    const agentError = ref('')
    const agentSystemPrompt = ref('')

    const notas = computed(() => store.notasByProject[proyectoId.value] || [])
    const loading = computed(() => store.loadingByProject[proyectoId.value] || false)

    const parsedJson = computed(() => {
      if (!editValor.value) return null
      try {
        return JSON.parse(editValor.value)
      } catch {
        return null
      }
    })
    const isJson = computed(() => parsedJson.value !== null && typeof parsedJson.value === 'object')

    async function loadListWidth() {
      try {
        const result = await settingGet(LIST_WIDTH_KEY)
        if (result.value) {
          listWidth.value = Math.max(LIST_MIN, parseInt(result.value, 10) || LIST_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho de lista de notas:', err)
      }
    }

    async function saveListWidth() {
      try {
        await settingSet(LIST_WIDTH_KEY, String(listWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho de lista de notas:', err)
      }
    }

    function onSplitStart(e) {
      const startX = e.clientX
      const startWidth = listWidth.value
      const container = e.target.closest('.doc-notas-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = LIST_MIN
        const maxWidth = containerWidth - LIST_MIN
        listWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveListWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    async function loadToolsWidth() {
      try {
        const result = await settingGet(TOOLS_WIDTH_KEY)
        if (result.value) {
          toolsWidth.value = Math.max(TOOLS_MIN, parseInt(result.value, 10) || TOOLS_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho de herramientas:', err)
      }
    }

    async function saveToolsWidth() {
      try {
        await settingSet(TOOLS_WIDTH_KEY, String(toolsWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho de herramientas:', err)
      }
    }

    function onToolsSplitStart(e) {
      const startX = e.clientX
      const startWidth = toolsWidth.value
      const container = e.target.closest('.doc-notas-container')

      function onMouseMove(e) {
        const delta = startX - e.clientX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = TOOLS_MIN
        const maxWidth = containerWidth - listWidth.value - TOOLS_MIN
        toolsWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveToolsWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function sanitizeClave() {
      editClave.value = editClave.value.replace(/\s+/g, '')
    }

    async function seleccionarNota(n) {
      selectedNota.value = n
      editClave.value = n.clave
      store.currentClave = n.clave
      const full = await store.getNota(proyectoId.value, n.clave)
      if (full) {
        editValor.value = full.valor || ''
        store.currentValor = full.valor || ''
        selectedNota.value = full
      } else {
        editValor.value = ''
        store.currentValor = ''
      }
    }

    async function guardarNota() {
      if (!selectedNota.value) return
      const newClave = editClave.value.trim()
      if (!newClave) return
      try {
        const updated = await store.updateNota(selectedNota.value.id, {
          clave: newClave,
          valor: editValor.value,
          id_ticket: selectedNota.value.id_ticket,
        }, proyectoId.value)
        selectedNota.value.clave = newClave
        selectedNota.value.valor = editValor.value
        store.currentClave = newClave
        store.currentValor = editValor.value
      } catch (err) {
        console.error('Error al guardar nota:', err)
      }
    }

    function abrirCrear() {
      modal.open(DocCreateModal, {
        proyectoId: proyectoId.value,
        ticketId: ticketId.value,
      }, {
        title: 'Nueva nota de documentación',
      })
    }

    async function eliminarNota(n) {
      if (!confirm(`¿Eliminar la nota "${n.clave}"?`)) return
      try {
        await store.deleteNota(n.id, proyectoId.value)
        if (selectedNota.value?.id === n.id) {
          selectedNota.value = null
          editValor.value = ''
          store.currentClave = null
          store.currentValor = ''
        }
      } catch (err) {
        console.error('Error al eliminar nota:', err)
      }
    }

    async function loadAgentSystemPrompt() {
      try {
        const result = await settingGet(AGENT_SYSTEM_PROMPT_KEY)
        if (result.value) {
          agentSystemPrompt.value = result.value
        }
      } catch (err) {
        console.error('Error al cargar prompt del agente:', err)
      }
    }

    function openAgentPromptModal() {
      modal.open(DocAgentPromptModal, {
        initialPrompt: agentSystemPrompt.value,
      }, {
        title: 'Prompt del Sistema',
        onClose() {
          settingGet(AGENT_SYSTEM_PROMPT_KEY).then((result) => {
            if (result.value) agentSystemPrompt.value = result.value
          }).catch((err) => {
            console.error('Error al recargar prompt del agente:', err)
          })
        },
      })
    }

    async function generateJson() {
      if (!selectedNota.value || agentLoading.value) return
      agentLoading.value = true
      agentError.value = ''

      const noteContent = editValor.value
      const systemPrompt = agentSystemPrompt.value + (agentInstructions.value ? '\n\n' + agentInstructions.value : '')

      const msgKey = 'agent-' + Date.now()
      chat.pushMessage({ role: 'assistant', content: '', thinking: '', _key: msgKey })

      try {
        const res = await fetch(`/api/chat/sessions/${chat.activeSessionId}/agent-documentacion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ noteContent, systemPrompt }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => null)
          throw new Error(errData?.error || `Error ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accThinking = ''
        let accResponse = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            try {
              const json = JSON.parse(trimmed.slice(6))
              if (json.type === 'thinking') {
                accThinking += json.content
                chat.updateMessageByKey(msgKey, { thinking: accThinking })
              } else if (json.type === 'response') {
                accResponse += json.content
                chat.updateMessageByKey(msgKey, { content: accResponse })
              } else if (json.type === 'error') {
                agentError.value = json.content
              }
            } catch (e) {
              // skip malformed
            }
          }
        }
      } catch (err) {
        console.error('Error al generar JSON:', err)
        agentError.value = err.message
        const idx = chat.findMessageIndex(msgKey)
        if (idx >= 0) chat.spliceMessages(idx, 1)
      } finally {
        agentLoading.value = false
      }
    }

    async function copiarContenido() {
      if (!editValor.value) return
      try {
        await navigator.clipboard.writeText(editValor.value)
      } catch (err) {
        console.error('Error al copiar:', err)
      }
    }

    watch(proyectoId, (newId) => {
      selectedNota.value = null
      editValor.value = ''
      store.currentClave = null
      store.currentValor = ''
      if (newId) {
        store.loadNotas(newId)
      } else {
        store.clearNotas()
      }
    })

    onMounted(() => {
      loadListWidth()
      loadToolsWidth()
      loadAgentSystemPrompt()
      if (proyectoId.value) {
        store.loadNotas(proyectoId.value)
      }
    })

    return {
      listWidth,
      toolsWidth,
      notas,
      loading,
      selectedNota,
      editValor,
      editClave,
      previewMode,
      sanitizeClave,
      claveEditInput,
      MAX_VALOR,
      onSplitStart,
      onToolsSplitStart,
      seleccionarNota,
      guardarNota,
      abrirCrear,
      eliminarNota,
      agentInstructions,
      agentLoading,
      agentError,
      openAgentPromptModal,
      generateJson,
      isJson,
      parsedJson,
      copiarContenido,
      proyectoId,
    }
  },
}
</script>

<style scoped>
.doc-notas-container {
  background: #16213e;
}
.doc-notas-list {
  background: #16213e;
}
.doc-nota-item {
  background: #1a2744;
  border: 1px solid #374151;
  cursor: pointer;
}
.doc-nota-item:hover {
  background: #1e3050;
}
.doc-nota-item.selected {
  background: #1e3050;
  border-color: #75AADB;
}
.doc-nota-clave {
  color: #75AADB;
  font-size: 0.75rem;
}
.doc-nota-ticket {
  font-size: 0.6rem;
  color: #6b7280;
}
.doc-nota-delete-btn {
  display: none;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0 4px;
  line-height: 1.2;
  border-radius: 3px;
  flex-shrink: 0;
}
.doc-nota-item:hover .doc-nota-delete-btn {
  display: block;
}
.doc-nota-delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
.doc-notas-tools {
  background: #16213e;
  border-left: 1px solid #374151;
}
.doc-notas-tools-header {
  padding: 8px 10px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid #374151;
  flex-shrink: 0;
}
.doc-notas-tools-body {
  gap: 6px;
}
.doc-notas-agent-input {
  background: #0f172a;
  color: #cbd5e1;
  border: 1px solid #374151;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: monospace;
  padding: 6px;
  resize: vertical;
  min-height: 60px;
  max-height: 120px;
  outline: none;
}
.doc-notas-agent-input:focus {
  border-color: #75AADB;
}
.doc-notas-agent-input::placeholder {
  color: #4b5563;
}
.doc-notas-agent-input:disabled {
  opacity: 0.5;
}
.doc-notas-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.doc-notas-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.doc-notas-editor {
  background: #0f172a;
}
.doc-notas-textarea {
  background: #0f172a;
  color: #cbd5e1;
  font-size: 0.75rem;
  font-family: monospace;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.doc-notas-textarea::placeholder {
  color: #4b5563;
}
.doc-notas-preview {
  background: #0f172a;
  color: #cbd5e1;
  font-size: 0.75rem;
  line-height: 1.6;
}
.doc-notas-preview h3,
.doc-notas-preview h4,
.doc-notas-preview h5 {
  color: #f1f5f9;
  margin: 0.5em 0 0.25em;
  font-weight: 600;
}
.doc-notas-preview h3 { font-size: 0.95rem; }
.doc-notas-preview h4 { font-size: 0.85rem; }
.doc-notas-preview h5 { font-size: 0.8rem; }
.doc-notas-preview p { margin: 0.25em 0; }
.doc-notas-preview code {
  background: #1e293b;
  color: #75AADB;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.7rem;
}
.doc-notas-preview pre {
  background: #1e293b;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.doc-notas-preview pre code {
  background: none;
  padding: 0;
  color: #cbd5e1;
}
.doc-notas-preview ul,
.doc-notas-preview ol {
  padding-left: 1.2rem;
  margin: 0.25em 0;
}
.doc-notas-preview li {
  margin: 0.1em 0;
}
.doc-notas-preview a {
  color: #75AADB;
  text-decoration: underline;
}
.doc-notas-preview strong { color: #f1f5f9; }
.doc-notas-preview em { font-style: italic; }
.doc-notas-clave-input {
  background: none;
  border: none;
  color: #75AADB;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
  outline: none;
  padding: 0;
  min-width: 50px;
}
.doc-notas-clave-input:focus {
  border-bottom: 1px solid #75AADB;
}
</style>
