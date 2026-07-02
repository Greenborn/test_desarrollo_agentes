<template>
  <div class="file-editor-modal d-flex" style="height: 80vh;">
    <div class="d-flex flex-column flex-grow-1" style="min-width: 0; min-height: 0;">
      <div v-if="loading" class="d-flex align-items-center justify-content-center flex-grow-1 text-muted small">
        Cargando archivo...
      </div>
      <div v-else-if="error" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-danger small px-3">
        <span>{{ error }}</span>
        <button class="btn btn-sm btn-outline-secondary mt-2" @click="reload">Reintentar</button>
      </div>
      <div v-else class="d-flex flex-column flex-grow-1" style="min-height: 0;">
        <div class="file-path text-muted small px-3 py-1 flex-shrink-0 d-flex align-items-center justify-content-between">
          <span class="text-truncate">{{ filePath }}</span>
          <button v-if="isMarkdown" class="btn btn-sm" :class="editMode ? 'btn-outline-primary' : 'btn-outline-info'" @click="toggleMode">
            {{ editMode ? 'Vista previa' : 'Editar' }}
          </button>
        </div>
        <div v-if="isMarkdown && !editMode" class="preview-content flex-grow-1 overflow-y-auto px-3 py-2" style="min-height: 0;">
          <ChatFormatter :text="content" />
        </div>
        <textarea v-show="!isMarkdown || editMode"
          class="file-editor form-control flex-grow-1 border-0 rounded-0"
          v-model="content"
          :disabled="saving"
          spellcheck="false"
        ></textarea>
        <div class="d-flex align-items-center gap-2 px-3 py-2 flex-shrink-0" style="background: #1a1a2e;">
          <span v-if="saving" class="text-muted small">Guardando...</span>
          <span v-if="saved" class="text-success small">✓ Guardado</span>
          <button class="btn btn-sm btn-argentina ms-auto" @click="save" :disabled="saving || !dirty">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
          <button class="btn btn-sm btn-outline-secondary" @click="$emit('close')" :disabled="saving">Cancelar</button>
        </div>
      </div>
    </div>
    <div class="editor-oc-splitter" @mousedown.prevent="onOcSplitStart"></div>
    <div class="editor-oc-panel flex-shrink-0 overflow-hidden" :style="{ width: ocPanelWidth + 'px' }">
      <FileEditorOpenCodeChat :cwd="cwd" />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import ChatFormatter from '../chat/ChatFormatter.vue'
import FileEditorOpenCodeChat from './FileEditorOpenCodeChat.vue'
import { useChatStore } from '../../stores/chat.js'
import { settingSet, settingGet } from '../../services/settingService.js'

const API = '/api'
const OC_PANEL_WIDTH_KEY = 'editor_oc_width'
const OC_PANEL_WIDTH_DEFAULT = 320
const OC_PANEL_WIDTH_MIN = 200

export default {
  components: { ChatFormatter, FileEditorOpenCodeChat },
  props: {
    filePath: { type: String, required: true },
    sessionId: { type: [Number, String], default: null },
  },
  emits: ['close'],
  setup(props) {
    const chat = useChatStore()
    const content = ref('')
    const originalContent = ref('')
    const loading = ref(false)
    const saving = ref(false)
    const saved = ref(false)
    const error = ref(null)
    const editMode = ref(false)
    const ocPanelWidth = ref(OC_PANEL_WIDTH_DEFAULT)

    const dirty = computed(() => content.value !== originalContent.value)
    const isMarkdown = computed(() => props.filePath.toLowerCase().endsWith('.md'))

    const cwd = computed(() => {
      if (props.sessionId) {
        const session = chat.sessions.find(s => Number(s.id) === Number(props.sessionId))
        if (session?.cwd) return session.cwd
      }
      const lastSlash = props.filePath.lastIndexOf('/')
      return lastSlash > 0 ? props.filePath.slice(0, lastSlash) : null
    })

    async function loadOcPanelWidth() {
      try {
        const data = await settingGet(OC_PANEL_WIDTH_KEY)
        if (data.value !== null) {
          ocPanelWidth.value = Math.max(OC_PANEL_WIDTH_MIN, parseInt(data.value, 10) || OC_PANEL_WIDTH_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho del panel OC:', err)
      }
    }

    async function saveOcPanelWidth() {
      try {
        await settingSet(OC_PANEL_WIDTH_KEY, String(ocPanelWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho del panel OC:', err)
      }
    }

    function onOcSplitStart(e) {
      const container = e.target.closest('.file-editor-modal')

      function onMouseMove(e) {
        const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth
        const newWidth = containerWidth - (e.clientX - container.getBoundingClientRect().left)
        ocPanelWidth.value = Math.max(OC_PANEL_WIDTH_MIN, Math.min(containerWidth * 0.5, newWidth))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveOcPanelWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function toggleMode() {
      editMode.value = !editMode.value
    }

    async function loadFile(filePath) {
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`${API}/command/read-file?path=${encodeURIComponent(filePath)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          content.value = data.content
          originalContent.value = data.content
        } else {
          error.value = data.error || 'Error al leer el archivo'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    async function save() {
      saving.value = true
      saved.value = false
      error.value = null
      try {
        const res = await fetch(`${API}/command/write-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: props.filePath, content: content.value }),
        })
        const data = await res.json()
        if (data.success) {
          originalContent.value = content.value
          saved.value = true
          setTimeout(() => { saved.value = false }, 2000)
        } else {
          error.value = data.error || 'Error al guardar el archivo'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        saving.value = false
      }
    }

    function reload() {
      loadFile(props.filePath)
    }

    onMounted(() => {
      loadFile(props.filePath)
      loadOcPanelWidth()
    })

    return {
      content, loading, saving, saved, error, dirty,
      editMode, isMarkdown, toggleMode,
      save, reload, cwd,
      ocPanelWidth, onOcSplitStart,
    }
  },
}
</script>

<style scoped>
.file-editor-modal {
  background: #1a1a2e;
  border-radius: 4px;
}
.file-path {
  border-bottom: 1px solid #374151;
  word-break: break-all;
}
.preview-content {
  background: #0d1117;
  color: #c9d1d9;
  font-size: 0.8rem;
  line-height: 1.5;
}
.file-editor {
  background: #0d1117 !important;
  color: #c9d1d9 !important;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace !important;
  font-size: 0.8rem !important;
  line-height: 1.5 !important;
  tab-size: 2;
  resize: none;
  padding: 12px !important;
}
.file-editor:focus {
  box-shadow: none !important;
  outline: none !important;
}
.file-editor::placeholder {
  color: #484f58;
}
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.editor-oc-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.editor-oc-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.editor-oc-panel {
  border-left: 1px solid #374151;
  min-width: 200px;
}
</style>
