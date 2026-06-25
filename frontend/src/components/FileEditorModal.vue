<template>
  <div class="file-editor-modal d-flex flex-column" style="height: 80vh;">
    <div v-if="loading" class="d-flex align-items-center justify-content-center flex-grow-1 text-muted small">
      Cargando archivo...
    </div>
    <div v-else class="d-flex flex-column flex-grow-1" style="min-height: 0;">
      <div class="file-path text-muted small px-3 py-1 flex-shrink-0 text-truncate" :title="filePath">
        {{ filePath }}
      </div>
      <div v-if="error" class="alert alert-danger small mx-3 mt-1 py-1 px-2 flex-shrink-0">
        {{ error }}
      </div>
      <textarea
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
import { onMounted } from 'vue'
import { useFileEditorStore } from '../stores/fileEditor.js'

export default {
  props: {
    filePath: { type: String, required: true },
  },
  emits: ['close'],
  setup(props) {
    const editorStore = useFileEditorStore()

    function save() {
      editorStore.save(props.filePath)
    }

    onMounted(() => editorStore.loadFile(props.filePath))

    return {
      content: editorStore.content,
      loading: editorStore.loading,
      saving: editorStore.saving,
      saved: editorStore.saved,
      error: editorStore.error,
      dirty: editorStore.dirty,
      save,
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
