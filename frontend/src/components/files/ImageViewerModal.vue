<template>
  <div class="image-viewer-modal d-flex flex-column">
    <div v-if="loading" class="d-flex align-items-center justify-content-center flex-grow-1 text-muted small">
      Cargando imagen...
    </div>
    <div v-else-if="error" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-danger small px-3">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-outline-secondary mt-2" @click="reload">Reintentar</button>
    </div>
    <div v-else class="d-flex flex-column flex-grow-1" style="min-height: 0;">
      <div class="file-path text-muted small px-3 py-1 flex-shrink-0">
        <span class="text-truncate">{{ filePath }}</span>
      </div>
      <div class="image-container flex-grow-1 d-flex align-items-center justify-content-center overflow-auto p-3" style="min-height: 0;">
        <img :src="imageSrc" :alt="fileName" class="img-fluid" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
      </div>
      <div class="d-flex align-items-center gap-2 px-3 py-2 flex-shrink-0" style="background: #1a1a2e;">
        <span class="text-muted small">{{ fileName }} ({{ fileSize }})</span>
        <button class="btn btn-sm btn-outline-secondary ms-auto" @click="$emit('close')">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

const API = '/api'

export default {
  props: {
    filePath: { type: String, required: true },
  },
  emits: ['close'],
  setup(props) {
    const loading = ref(false)
    const error = ref(null)
    const base64 = ref(null)
    const mime = ref(null)
    const fileSize = ref('')

    const fileName = computed(() => props.filePath.split('/').pop() || props.filePath)
    const imageSrc = computed(() => base64.value && mime.value ? `data:${mime.value};base64,${base64.value}` : null)

    function formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    async function loadImage(filePath) {
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`${API}/command/read-file-base64?path=${encodeURIComponent(filePath)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          base64.value = data.base64
          mime.value = data.mime
          if (data.size) fileSize.value = formatSize(data.size)
          else fileSize.value = ''
        } else {
          error.value = data.error || 'Error al leer la imagen'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    function reload() {
      loadImage(props.filePath)
    }

    onMounted(() => {
      loadImage(props.filePath)
    })

    return {
      loading, error, imageSrc, fileName, fileSize, reload,
    }
  },
}
</script>

<style scoped>
.image-viewer-modal {
  background: #1a1a2e;
  border-radius: 4px;
  height: 80vh;
}
.file-path {
  border-bottom: 1px solid #374151;
  word-break: break-all;
}
.image-container {
  background: #0d1117;
}
.image-container img {
  border-radius: 4px;
}
</style>
