<template>
  <div class="file-preview-panel d-flex flex-column h-100">
    <div v-if="!filePath" class="preview-placeholder d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
      <span>Seleccione un archivo para previsualizar</span>
    </div>
    <template v-else-if="!isMarkdown">
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate">
        {{ fileName }}
      </div>
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Vista previa solo disponible para archivos .md</span>
      </div>
    </template>
    <template v-else>
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate d-flex align-items-center justify-content-between">
        <span class="text-truncate">{{ fileName }}</span>
      </div>
      <div class="preview-content flex-grow-1 overflow-y-auto px-2 py-2" style="min-height: 0;">
        <div v-if="loading" class="d-flex align-items-center justify-content-center text-secondary small py-4">
          <span>Cargando vista previa…</span>
        </div>
        <div v-else-if="error" class="text-danger small py-2">
          {{ error }}
        </div>
        <ChatFormatter v-else :text="content" />
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import ChatFormatter from './ChatFormatter.vue'

export default {
  components: { ChatFormatter },
  props: {
    filePath: { type: String, default: null },
  },
  setup(props) {
    const content = ref('')
    const loading = ref(false)
    const error = ref(null)

    const fileName = computed(() => {
      if (!props.filePath) return ''
      return props.filePath.split('/').pop() || props.filePath
    })

    const isMarkdown = computed(() => {
      return props.filePath ? props.filePath.toLowerCase().endsWith('.md') : false
    })

    async function loadPreview() {
      if (!props.filePath || !isMarkdown.value) {
        content.value = ''
        error.value = null
        return
      }
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`/api/command/read-file?path=${encodeURIComponent(props.filePath)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          content.value = data.content
        } else {
          error.value = data.error || 'Error al leer el archivo'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    watch(() => props.filePath, () => {
      loadPreview()
    })

    return { content, loading, error, fileName, isMarkdown }
  },
}
</script>

<style scoped>
.file-preview-panel {
  font-size: 0.75rem;
  color: #d1d5db;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid #374151;
}
.preview-header {
  border-bottom: 1px solid #374151;
  white-space: nowrap;
  color: #9ca3af;
}
.preview-content {
  background: #16213e;
}
.preview-placeholder {
  background: #16213e;
}
</style>
