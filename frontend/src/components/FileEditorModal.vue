<template>
  <div class="file-editor-modal d-flex flex-column" style="height: 80vh;">
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
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useFileEditorStore } from '../stores/fileEditor.js'
import ChatFormatter from './ChatFormatter.vue'

export default {
  components: { ChatFormatter },
  props: {
    filePath: { type: String, required: true },
  },
  emits: ['close'],
  setup(props) {
    const editorStore = useFileEditorStore()
    const editMode = ref(false)

    const isMarkdown = computed(() => props.filePath.toLowerCase().endsWith('.md'))

    function toggleMode() {
      editMode.value = !editMode.value
    }

    function save() {
      editorStore.save(props.filePath)
    }

    function reload() {
      editorStore.loadFile(props.filePath)
    }

    onMounted(() => {
      editorStore.reset()
      editorStore.loadFile(props.filePath)
    })

    return {
      content: editorStore.content,
      loading: editorStore.loading,
      saving: editorStore.saving,
      saved: editorStore.saved,
      error: editorStore.error,
      dirty: editorStore.dirty,
      editMode, isMarkdown, toggleMode,
      save, reload,
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
</style>
